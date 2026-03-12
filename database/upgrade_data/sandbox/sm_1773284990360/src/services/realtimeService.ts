import { ChatGroq } from '@langchain/groq';
import { GROQ_MODEL, REALTIME_CHAT_ADDENDUM, EXTENSION_CODE_CHAT_ADDENDUM, TAVILY_API_KEYS } from '../config.js';
import type { SearchPayload } from '../types/chat.js';
import { withRetry } from '../utils/retry.js';
import { AllGroqApisFailedError, escapeCurlyBraces, GroqService, type StreamChunk } from './groqService.js';
import type { VectorStoreService } from './vectorStore.js';

export class RealtimeGroqService extends GroqService {
  private fastLlm: ChatGroq | null;
  private tavilyKeys: string[];

  constructor(vectorStoreService: VectorStoreService) {
    super(vectorStoreService);
    this.fastLlm = null;
    this.tavilyKeys = Array.from(new Set((TAVILY_API_KEYS || []).map((k) => String(k || '').trim()).filter(Boolean)));
    this.updateFastLlm();
  }

  override updateApiKeys(keys: string[]): number {
    const count = super.updateApiKeys(keys);
    this.updateFastLlm();
    return count;
  }

  private updateFastLlm(): void {
    this.fastLlm = this.apiKeys.length
      ? new ChatGroq({
          apiKey: this.apiKeys[0],
          model: GROQ_MODEL,
          temperature: 0,
          timeout: 15_000,
          maxTokens: 50,
        })
      : null;
  }

  updateTavilyKeys(keys: string[]): number {
    this.tavilyKeys = Array.from(new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean)));
    return this.tavilyKeys.length;
  }

  private async extractSearchQuery(question: string, chatHistory?: Array<[string, string]>): Promise<string> {
    if (!this.fastLlm) return question;
    try {
      const recent = (chatHistory || []).slice(-3);
      const historyText = recent
        .map(([u, a]) => `User: ${u.slice(0, 200)}\nAssistant: ${a.slice(0, 200)}`)
        .join('\n');
      const prompt = [
        'You are a search query optimizer.',
        'Create one short focused web search query (max 12 words).',
        'Resolve references like him/it/that using recent context.',
        'Output only the query.',
        historyText ? `Recent conversation:\n${historyText}` : '',
        `User message: ${question}`,
        'Search query:',
      ]
        .filter(Boolean)
        .join('\n\n');

      GroqService.noteExternalCall();
      const resp = await this.fastLlm.invoke(prompt);
      const query = String(resp.content || '').trim().replace(/^['\"]|['\"]$/g, '');
      if (query.length >= 3 && query.length <= 200) return query;
      return question;
    } catch {
      return question;
    }
  }

  async searchTavily(query: string, numResults = 7): Promise<{ formatted: string; payload: SearchPayload | null }> {
    if (!this.tavilyKeys.length) return { formatted: '', payload: null };

    try {
      let response: {
        answer?: string;
        results?: Array<{ title?: string; content?: string; url?: string; score?: number }>;
      } | null = null;
      let lastErr: unknown;
      for (const key of this.tavilyKeys) {
        try {
          response = await withRetry(async () => {
            const r = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: key,
                query,
                search_depth: 'advanced',
                max_results: numResults,
                include_answer: true,
                include_raw_content: false,
              }),
            });
            if (!r.ok) throw new Error(`Tavily HTTP ${r.status}`);
            return (await r.json()) as {
              answer?: string;
              results?: Array<{ title?: string; content?: string; url?: string; score?: number }>;
            };
          }, 2, 500);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!response) throw new Error(String(lastErr || 'Tavily all keys failed'));

      const answer = response.answer || '';
      const results = response.results || [];
      if (!answer && results.length === 0) return { formatted: '', payload: null };

      const payload: SearchPayload = {
        query,
        answer,
        results: results.slice(0, numResults).map((r) => ({
          title: r.title || 'No title',
          content: (r.content || '').slice(0, 500),
          url: r.url || '',
          score: Number((r.score || 0).toFixed(2)),
        })),
      };

      const parts: string[] = [`=== WEB SEARCH RESULTS FOR: ${query} ===\n`];
      if (answer) parts.push(`AI-SYNTHESIZED ANSWER:\n${answer}\n`);
      if (results.length) {
        parts.push('INDIVIDUAL SOURCES:');
        results.slice(0, numResults).forEach((r, idx) => {
          parts.push(`\n[Source ${idx + 1}] (relevance: ${(r.score || 0).toFixed(2)})`);
          parts.push(`Title: ${r.title || 'No title'}`);
          if (r.content) parts.push(`Content: ${r.content}`);
          if (r.url) parts.push(`URL: ${r.url}`);
        });
      }
      parts.push('\n=== END SEARCH RESULTS ===');

      return { formatted: parts.join('\n'), payload };
    } catch {
      return { formatted: '', payload: null };
    }
  }

  override async getResponse(question: string, chatHistory?: Array<[string, string]>): Promise<string> {
    try {
      const query = await this.extractSearchQuery(question, chatHistory);
      const { formatted } = await this.searchTavily(query, 7);
      const extra = formatted ? [escapeCurlyBraces(formatted)] : undefined;
      const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, extra, REALTIME_CHAT_ADDENDUM);
      return this.invokeLlm(prompt, messages, question);
    } catch (err) {
      if (err instanceof AllGroqApisFailedError) throw err;
      throw err;
    }
  }

  override async getResponseWithMeta(question: string, chatHistory?: Array<[string, string]>): Promise<{ response: string; meta: { sources: string[]; confidence: number } }> {
    const query = await this.extractSearchQuery(question, chatHistory);
    const { formatted } = await this.searchTavily(query, 7);
    const extra = formatted ? [escapeCurlyBraces(formatted)] : undefined;
    const { prompt, messages, meta } = this.buildPromptAndMessages(question, chatHistory, extra, REALTIME_CHAT_ADDENDUM);
    const response = await this.invokeLlm(prompt, messages, question);
    return { response, meta };
  }

  async *streamResponse(question: string, chatHistory?: Array<[string, string]>): AsyncGenerator<StreamChunk> {
    const query = await this.extractSearchQuery(question, chatHistory);
    const { formatted, payload } = await this.searchTavily(query, 7);

    if (payload) {
      yield { _search_results: payload };
    }

    const extra = formatted ? [escapeCurlyBraces(formatted)] : undefined;
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, extra, REALTIME_CHAT_ADDENDUM);
    yield* this.streamLlm(prompt, messages, question);
  }

  override streamResponseWithMeta(
    question: string,
    chatHistory?: Array<[string, string]>,
  ): { stream: AsyncGenerator<StreamChunk>; meta: { sources: string[]; confidence: number } } {
    const self = this;
    async function* wrapped(): AsyncGenerator<StreamChunk> {
      const query = await self.extractSearchQuery(question, chatHistory);
      const { formatted, payload } = await self.searchTavily(query, 7);
      if (payload) yield { _search_results: payload };
      const extra = formatted ? [escapeCurlyBraces(formatted)] : undefined;
      const { prompt, messages } = self.buildPromptAndMessages(question, chatHistory, extra, REALTIME_CHAT_ADDENDUM);
      yield* self.streamLlm(prompt, messages, question);
    }

    const { meta } = this.buildPromptAndMessages(question, chatHistory, undefined, REALTIME_CHAT_ADDENDUM);
    return { stream: wrapped(), meta };
  }
  async getExtensionCodeRealtimeResponseWithMeta(question: string, chatHistory?: Array<[string, string]>): Promise<{ response: string; meta: { sources: string[]; confidence: number } }> {
    const query = await this.extractSearchQuery(question, chatHistory);
    const { formatted } = await this.searchTavily(query, 7);
    const extra = formatted ? [escapeCurlyBraces(formatted)] : undefined;
    const addendum = `${REALTIME_CHAT_ADDENDUM}\n\n${EXTENSION_CODE_CHAT_ADDENDUM}`;
    const { prompt, messages, meta } = this.buildPromptAndMessages(question, chatHistory, extra, addendum);
    const response = await this.invokeLlm(prompt, messages, question);
    return { response, meta };
  }

  streamExtensionCodeRealtimeResponseWithMeta(
    question: string,
    chatHistory?: Array<[string, string]>,
  ): { stream: AsyncGenerator<StreamChunk>; meta: { sources: string[]; confidence: number } } {
    const self = this;
    async function* wrapped(): AsyncGenerator<StreamChunk> {
      const query = await self.extractSearchQuery(question, chatHistory);
      const { formatted, payload } = await self.searchTavily(query, 7);
      if (payload) yield { _search_results: payload };
      const extra = formatted ? [escapeCurlyBraces(formatted)] : undefined;
      const addendum = `${REALTIME_CHAT_ADDENDUM}\n\n${EXTENSION_CODE_CHAT_ADDENDUM}`;
      const { prompt, messages } = self.buildPromptAndMessages(question, chatHistory, extra, addendum);
      yield* self.streamLlm(prompt, messages, question);
    }

    const addendum = `${REALTIME_CHAT_ADDENDUM}\n\n${EXTENSION_CODE_CHAT_ADDENDUM}`;
    const { meta } = this.buildPromptAndMessages(question, chatHistory, undefined, addendum);
    return { stream: wrapped(), meta };
  }

}
