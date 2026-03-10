import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  GENERAL_CHAT_ADDENDUM,
  EXTENSION_CODE_CHAT_ADDENDUM,
  GEMINI_API_KEY,
  GEMINI_API_KEYS,
  GEMINI_MODEL,
  GROQ_API_KEYS,
  GROQ_MODEL,
  JARVIS_SYSTEM_PROMPT,
  OPENROUTER_API_KEY,
  OPENROUTER_API_KEYS,
  OPENROUTER_MODEL,
  OPENROUTER_MODELS,
} from '../config.js';
import { getTimeInformation } from '../utils/timeInfo.js';
import { withRetry } from '../utils/retry.js';
import type { VectorStoreService } from './vectorStore.js';

export class AllGroqApisFailedError extends Error {}
export type StreamChunk = string | { _search_results: unknown };
export interface ResponseMeta {
  sources: string[];
  confidence: number;
}

export function escapeCurlyBraces(text: string): string {
  return text.replace(/\{/g, '{{').replace(/\}/g, '}}');
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('tokens per day');
}

function maskKey(key: string): string {
  if (!key || key.length <= 12) return '***masked***';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

export class GroqService {
  private static readonly callTraceStore = new AsyncLocalStorage<{ traceId: string; calls: number }>();
  private static openRouterKeys = OPENROUTER_API_KEYS.length ? OPENROUTER_API_KEYS : (OPENROUTER_API_KEY ? [OPENROUTER_API_KEY] : []);
  private static openRouterModels = OPENROUTER_MODELS.length ? OPENROUTER_MODELS : [OPENROUTER_MODEL];
  private static geminiKeys = GEMINI_API_KEYS.length ? GEMINI_API_KEYS : (GEMINI_API_KEY ? [GEMINI_API_KEY] : []);
  protected apiKeys: string[];
  protected llms: ChatGroq[];

  constructor(protected vectorStoreService: VectorStoreService) {
    this.apiKeys = [];
    this.llms = [];
    this.updateApiKeys(GROQ_API_KEYS);
  }

  updateApiKeys(keys: string[]): number {
    const next = Array.from(new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean)));
    this.apiKeys = next;
    this.llms = next.map(
      (key) =>
        new ChatGroq({
          apiKey: key,
          model: GROQ_MODEL,
          temperature: 0.6,
          timeout: 60_000,
        }),
    );
    if (this.llms.length === 0 && !this.hasExternalProviders()) {
      throw new Error('No LLM provider configured. Add GROQ_API_KEY or OPENROUTER_API_KEY or GEMINI_API_KEY');
    }
    return this.apiKeys.length;
  }

  listMaskedApiKeys(): string[] {
    return this.apiKeys.map((key) => maskKey(key));
  }

  static withCallTrace<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
    return this.callTraceStore.run({ traceId, calls: 0 }, fn);
  }

  static currentCallTrace(): { traceId: string; calls: number } | null {
    const s = this.callTraceStore.getStore();
    if (!s) return null;
    return { traceId: s.traceId, calls: s.calls };
  }

  static noteExternalCall(): void {
    const s = this.callTraceStore.getStore();
    if (s) s.calls += 1;
  }

  static updateExternalApiKeys(input: { openrouter_api_keys?: string[]; openrouter_models?: string[]; gemini_api_keys?: string[] }): void {
    if (Array.isArray(input.openrouter_api_keys)) {
      this.openRouterKeys = Array.from(new Set(input.openrouter_api_keys.map((k) => String(k || '').trim()).filter(Boolean)));
    }
    if (Array.isArray(input.openrouter_models)) {
      const models = Array.from(new Set(input.openrouter_models.map((m) => String(m || '').trim()).filter(Boolean)));
      if (models.length) this.openRouterModels = models;
    }
    if (Array.isArray(input.gemini_api_keys)) {
      this.geminiKeys = Array.from(new Set(input.gemini_api_keys.map((k) => String(k || '').trim()).filter(Boolean)));
    }
  }

  private noteLlmCall(): void {
    const s = GroqService.callTraceStore.getStore();
    if (s) s.calls += 1;
  }

  private hasExternalProviders(): boolean {
    return GroqService.openRouterKeys.length > 0 || GroqService.geminiKeys.length > 0;
  }

  private async buildFallbackMessages(
    prompt: ChatPromptTemplate,
    messages: Array<HumanMessage | AIMessage>,
    question: string,
  ): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const formatted = await prompt.formatMessages({ history: messages, question });
    const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    for (const msg of formatted) {
      const role = msg.getType();
      const content = String(msg.content ?? '').trim();
      if (!content) continue;
      if (role === 'system') out.push({ role: 'system', content });
      else if (role === 'ai') out.push({ role: 'assistant', content });
      else out.push({ role: 'user', content });
    }
    return out;
  }

  private async invokeOpenRouter(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
    if (GroqService.openRouterKeys.length === 0) throw new Error('OPENROUTER_API_KEY is not configured');
    let lastErr: unknown;
    for (const model of GroqService.openRouterModels) {
      for (const key of GroqService.openRouterKeys) {
        try {
          GroqService.noteExternalCall();
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.6,
            }),
          });
          if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status} model=${model}`);
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const text = String(data?.choices?.[0]?.message?.content || '').trim();
          if (!text) throw new Error(`OpenRouter empty response model=${model}`);
          if (model !== GroqService.openRouterModels[0]) {
            console.info(`[OPENROUTER] fallback model used: ${model}`);
          }
          return text;
        } catch (err) {
          lastErr = err;
        }
      }
    }
    throw new Error(`OpenRouter all keys failed: ${String(lastErr)}`);
  }

  private async invokeGemini(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
    if (GroqService.geminiKeys.length === 0) throw new Error('GEMINI_API_KEY is not configured');
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    let lastErr: unknown;
    for (const key of GroqService.geminiKeys) {
      try {
        GroqService.noteExternalCall();
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: system ? { parts: [{ text: system }] } : undefined,
            contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
            generationConfig: { temperature: 0.6 },
          }),
        });
        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
        const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = String(data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ') || '').trim();
        if (!text) throw new Error('Gemini empty response');
        return text;
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(`Gemini all keys failed: ${String(lastErr)}`);
  }

  protected async invokeLlm(prompt: ChatPromptTemplate, messages: Array<HumanMessage | AIMessage>, question: string): Promise<string> {
    let lastErr: unknown;
    const fallbackMessages = await this.buildFallbackMessages(prompt, messages, question);

    for (let i = 0; i < this.llms.length; i += 1) {
      const llm = this.llms[i];
      try {
        const response = await withRetry(
          async () => {
            this.noteLlmCall();
            const chain = prompt.pipe(llm);
            return chain.invoke({ history: messages, question });
          },
          2,
          500,
        );
        if (i > 0) {
          console.info(`[GROQ] fallback key succeeded: ${i + 1}/${this.llms.length} ${maskKey(this.apiKeys[i])}`);
        }
        return response.content.toString();
      } catch (err) {
        lastErr = err;
        const rate = isRateLimitError(err);
        console.warn(`[GROQ] key ${i + 1}/${this.llms.length} failed${rate ? ' (rate-limit)' : ''}: ${maskKey(this.apiKeys[i])}`);
        if (rate) {
          await new Promise((resolve) => setTimeout(resolve, 1200 + (i * 600)));
        }
      }
    }
    if (GroqService.openRouterKeys.length > 0) {
      try {
        const text = await this.invokeOpenRouter(fallbackMessages);
        console.info('[LLM_FALLBACK] OpenRouter used after Groq failure');
        return text;
      } catch (err) {
        lastErr = err;
      }
    }
    if (GroqService.geminiKeys.length > 0) {
      try {
        const text = await this.invokeGemini(fallbackMessages);
        console.info('[LLM_FALLBACK] Gemini used after Groq/OpenRouter failure');
        return text;
      } catch (err) {
        lastErr = err;
      }
    }

    throw new AllGroqApisFailedError(`All configured LLM providers failed temporarily. Last error: ${String(lastErr)}`);
  }

  protected async *streamLlm(
    prompt: ChatPromptTemplate,
    messages: Array<HumanMessage | AIMessage>,
    question: string,
  ): AsyncGenerator<StreamChunk> {
    let lastErr: unknown;
    const fallbackMessages = await this.buildFallbackMessages(prompt, messages, question);

    for (let i = 0; i < this.llms.length; i += 1) {
      const llm = this.llms[i];
      try {
        this.noteLlmCall();
        const chain = prompt.pipe(llm);
        const stream = await chain.stream({ history: messages, question });
        for await (const chunk of stream) {
          const content = typeof chunk.content === 'string' ? chunk.content : String(chunk.content ?? '');
          if (content) yield content;
        }
        return;
      } catch (err) {
        lastErr = err;
        const rate = isRateLimitError(err);
        console.warn(`[GROQ] stream key ${i + 1}/${this.llms.length} failed${rate ? ' (rate-limit)' : ''}: ${maskKey(this.apiKeys[i])}`);
        if (rate) {
          await new Promise((resolve) => setTimeout(resolve, 1200 + (i * 600)));
        }
      }
    }
    if (GroqService.openRouterKeys.length > 0) {
      try {
        const text = await this.invokeOpenRouter(fallbackMessages);
        yield text;
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    if (GroqService.geminiKeys.length > 0) {
      try {
        const text = await this.invokeGemini(fallbackMessages);
        yield text;
        return;
      } catch (err) {
        lastErr = err;
      }
    }

    throw new AllGroqApisFailedError(`All configured LLM providers failed temporarily. Last error: ${String(lastErr)}`);
  }

  protected buildPromptAndMessages(
    question: string,
    chatHistory?: Array<[string, string]>,
    extraSystemParts?: string[],
    modeAddendum = '',
  ): { prompt: ChatPromptTemplate; messages: Array<HumanMessage | AIMessage>; meta: ResponseMeta } {
    const contextDocs = this.vectorStoreService.retrieveWithScores(question, 10);
    const contextText = contextDocs.map((d) => d.pageContent).join('\n');
    const sources = [...new Set(contextDocs.map((d) => d.source).filter(Boolean))];
    const topScore = contextDocs.length ? contextDocs[0].score : 0;
    const confidence = Math.max(0, Math.min(1, topScore / 5));

    let system = JARVIS_SYSTEM_PROMPT;
    system += `\n\nCurrent time and date:\n${getTimeInformation()}`;
    if (contextText.trim()) {
      system += `\n\nRelevant context:\n${escapeCurlyBraces(contextText)}`;
    }
    if (extraSystemParts?.length) {
      system += `\n\n${extraSystemParts.join('\n\n')}`;
    }
    if (modeAddendum) {
      system += `\n\n${modeAddendum}`;
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', system],
      new MessagesPlaceholder('history'),
      ['human', '{question}'],
    ]);

    const messages: Array<HumanMessage | AIMessage> = [];
    for (const [human, ai] of chatHistory || []) {
      messages.push(new HumanMessage(human));
      messages.push(new AIMessage(ai));
    }

    return { prompt, messages, meta: { sources, confidence } };
  }

  async getResponse(question: string, chatHistory?: Array<[string, string]>): Promise<string> {
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, undefined, GENERAL_CHAT_ADDENDUM);
    return this.invokeLlm(prompt, messages, question);
  }

  async getResponseWithMeta(question: string, chatHistory?: Array<[string, string]>): Promise<{ response: string; meta: ResponseMeta }> {
    const { prompt, messages, meta } = this.buildPromptAndMessages(question, chatHistory, undefined, GENERAL_CHAT_ADDENDUM);
    const response = await this.invokeLlm(prompt, messages, question);
    return { response, meta };
  }

  streamResponse(question: string, chatHistory?: Array<[string, string]>): AsyncGenerator<StreamChunk> {
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, undefined, GENERAL_CHAT_ADDENDUM);
    return this.streamLlm(prompt, messages, question);
  }

  streamResponseWithMeta(question: string, chatHistory?: Array<[string, string]>): { stream: AsyncGenerator<StreamChunk>; meta: ResponseMeta } {
    const { prompt, messages, meta } = this.buildPromptAndMessages(question, chatHistory, undefined, GENERAL_CHAT_ADDENDUM);
    return { stream: this.streamLlm(prompt, messages, question), meta };
  }
  async getExtensionCodeResponse(question: string, chatHistory?: Array<[string, string]>): Promise<string> {
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, undefined, EXTENSION_CODE_CHAT_ADDENDUM);
    return this.invokeLlm(prompt, messages, question);
  }

  async getExtensionCodeResponseWithMeta(question: string, chatHistory?: Array<[string, string]>): Promise<{ response: string; meta: ResponseMeta }> {
    const { prompt, messages, meta } = this.buildPromptAndMessages(question, chatHistory, undefined, EXTENSION_CODE_CHAT_ADDENDUM);
    const response = await this.invokeLlm(prompt, messages, question);
    return { response, meta };
  }

  streamExtensionCodeResponse(question: string, chatHistory?: Array<[string, string]>): AsyncGenerator<StreamChunk> {
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, undefined, EXTENSION_CODE_CHAT_ADDENDUM);
    return this.streamLlm(prompt, messages, question);
  }

  streamExtensionCodeResponseWithMeta(question: string, chatHistory?: Array<[string, string]>): { stream: AsyncGenerator<StreamChunk>; meta: ResponseMeta } {
    const { prompt, messages, meta } = this.buildPromptAndMessages(question, chatHistory, undefined, EXTENSION_CODE_CHAT_ADDENDUM);
    return { stream: this.streamLlm(prompt, messages, question), meta };
  }

}
