import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  GENERAL_CHAT_ADDENDUM,
  GROQ_API_KEYS,
  GROQ_MODEL,
  JARVIS_SYSTEM_PROMPT,
} from '../config.js';
import { getTimeInformation } from '../utils/timeInfo.js';
import { withRetry } from '../utils/retry.js';
import type { VectorStoreService } from './vectorStore.js';

export class AllGroqApisFailedError extends Error {}
export type StreamChunk = string | { _search_results: unknown };

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
  protected llms: ChatGroq[];

  constructor(protected vectorStoreService: VectorStoreService) {
    if (GROQ_API_KEYS.length === 0) {
      throw new Error('No Groq API keys configured');
    }
    this.llms = GROQ_API_KEYS.map(
      (key) =>
        new ChatGroq({
          apiKey: key,
          model: GROQ_MODEL,
          temperature: 0.6,
          timeout: 60_000,
        }),
    );
  }

  protected async invokeLlm(prompt: ChatPromptTemplate, messages: Array<HumanMessage | AIMessage>, question: string): Promise<string> {
    let lastErr: unknown;

    for (let i = 0; i < this.llms.length; i += 1) {
      const llm = this.llms[i];
      try {
        const response = await withRetry(
          async () => {
            const chain = prompt.pipe(llm);
            return chain.invoke({ history: messages, question });
          },
          2,
          500,
        );
        if (i > 0) {
          console.info(`[GROQ] fallback key succeeded: ${i + 1}/${this.llms.length} ${maskKey(GROQ_API_KEYS[i])}`);
        }
        return response.content.toString();
      } catch (err) {
        lastErr = err;
        const rate = isRateLimitError(err);
        console.warn(`[GROQ] key ${i + 1}/${this.llms.length} failed${rate ? ' (rate-limit)' : ''}: ${maskKey(GROQ_API_KEYS[i])}`);
      }
    }

    throw new AllGroqApisFailedError('All Groq API keys failed temporarily. Please try again shortly.');
  }

  protected async *streamLlm(
    prompt: ChatPromptTemplate,
    messages: Array<HumanMessage | AIMessage>,
    question: string,
  ): AsyncGenerator<StreamChunk> {
    let lastErr: unknown;

    for (let i = 0; i < this.llms.length; i += 1) {
      const llm = this.llms[i];
      try {
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
        console.warn(`[GROQ] stream key ${i + 1}/${this.llms.length} failed${rate ? ' (rate-limit)' : ''}: ${maskKey(GROQ_API_KEYS[i])}`);
      }
    }

    throw new AllGroqApisFailedError('All Groq API keys failed temporarily. Please try again shortly.');
  }

  protected buildPromptAndMessages(
    question: string,
    chatHistory?: Array<[string, string]>,
    extraSystemParts?: string[],
    modeAddendum = '',
  ): { prompt: ChatPromptTemplate; messages: Array<HumanMessage | AIMessage> } {
    const contextDocs = this.vectorStoreService.retrieve(question, 10);
    const contextText = contextDocs.map((d) => d.pageContent).join('\n');

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

    return { prompt, messages };
  }

  async getResponse(question: string, chatHistory?: Array<[string, string]>): Promise<string> {
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, undefined, GENERAL_CHAT_ADDENDUM);
    return this.invokeLlm(prompt, messages, question);
  }

  streamResponse(question: string, chatHistory?: Array<[string, string]>): AsyncGenerator<StreamChunk> {
    const { prompt, messages } = this.buildPromptAndMessages(question, chatHistory, undefined, GENERAL_CHAT_ADDENDUM);
    return this.streamLlm(prompt, messages, question);
  }
}
