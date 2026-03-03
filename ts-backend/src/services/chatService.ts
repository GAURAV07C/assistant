import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { CHATS_DATA_DIR, MAX_CHAT_HISTORY_TURNS } from '../config.js';
import type { ChatHistory, ChatMessage } from '../types/chat.js';
import { GroqService } from './groqService.js';
import { RealtimeGroqService } from './realtimeService.js';

const SAVE_EVERY_N_CHUNKS = 5;

export class ChatService {
  private sessions = new Map<string, ChatMessage[]>();

  constructor(private groqService: GroqService, private realtimeService?: RealtimeGroqService) {}

  private sessionFilePath(sessionId: string): string {
    const safe = sessionId.replace(/-/g, '').replace(/\s+/g, '_');
    return path.join(CHATS_DATA_DIR, `chat_${safe}.json`);
  }

  validateSessionId(sessionId: string): boolean {
    if (!sessionId || !sessionId.trim()) return false;
    if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) return false;
    return sessionId.length <= 255;
  }

  loadSessionFromDisk(sessionId: string): boolean {
    const file = this.sessionFilePath(sessionId);
    if (!fs.existsSync(file)) return false;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as ChatHistory;
      const msgs = (parsed.messages || []).map((m) => ({ role: m.role, content: m.content } as ChatMessage));
      this.sessions.set(sessionId, msgs);
      return true;
    } catch {
      return false;
    }
  }

  getOrCreateSession(sessionId?: string | null): string {
    if (!sessionId) {
      const id = uuidv4();
      this.sessions.set(id, []);
      return id;
    }

    if (!this.validateSessionId(sessionId)) {
      throw new Error('Invalid session_id format');
    }

    if (this.sessions.has(sessionId)) return sessionId;
    if (this.loadSessionFromDisk(sessionId)) return sessionId;

    this.sessions.set(sessionId, []);
    return sessionId;
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, []);
    this.sessions.get(sessionId)!.push({ role, content });
  }

  getChatHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) || [];
  }

  formatHistoryForLlm(sessionId: string, excludeLast = false): Array<[string, string]> {
    const messages = this.getChatHistory(sessionId);
    const working = excludeLast && messages.length ? messages.slice(0, -1) : messages;
    const pairs: Array<[string, string]> = [];

    for (let i = 0; i < working.length - 1; ) {
      const a = working[i];
      const b = working[i + 1];
      if (a.role === 'user' && b.role === 'assistant') {
        pairs.push([a.content, b.content]);
        i += 2;
      } else {
        i += 1;
      }
    }

    if (pairs.length > MAX_CHAT_HISTORY_TURNS) {
      return pairs.slice(-MAX_CHAT_HISTORY_TURNS);
    }
    return pairs;
  }

  async processMessage(sessionId: string, userMessage: string): Promise<string> {
    this.addMessage(sessionId, 'user', userMessage);
    const history = this.formatHistoryForLlm(sessionId, true);
    const response = await this.groqService.getResponse(userMessage, history);
    this.addMessage(sessionId, 'assistant', response);
    return response;
  }

  async processMessageWithMeta(sessionId: string, userMessage: string): Promise<{ response: string; sources: string[]; confidence: number }> {
    this.addMessage(sessionId, 'user', userMessage);
    const history = this.formatHistoryForLlm(sessionId, true);
    const out = await this.groqService.getResponseWithMeta(userMessage, history);
    this.addMessage(sessionId, 'assistant', out.response);
    return { response: out.response, sources: out.meta.sources, confidence: out.meta.confidence };
  }

  async processRealtimeMessage(sessionId: string, userMessage: string): Promise<string> {
    if (!this.realtimeService) throw new Error('Realtime service not initialized');
    this.addMessage(sessionId, 'user', userMessage);
    const history = this.formatHistoryForLlm(sessionId, true);
    const response = await this.realtimeService.getResponse(userMessage, history);
    this.addMessage(sessionId, 'assistant', response);
    return response;
  }

  async processRealtimeMessageWithMeta(sessionId: string, userMessage: string): Promise<{ response: string; sources: string[]; confidence: number }> {
    if (!this.realtimeService) throw new Error('Realtime service not initialized');
    this.addMessage(sessionId, 'user', userMessage);
    const history = this.formatHistoryForLlm(sessionId, true);
    const out = await this.realtimeService.getResponseWithMeta(userMessage, history);
    this.addMessage(sessionId, 'assistant', out.response);
    return { response: out.response, sources: out.meta.sources, confidence: out.meta.confidence };
  }

  async *processMessageStream(sessionId: string, userMessage: string): AsyncGenerator<string> {
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    let chunkCount = 0;

    try {
      for await (const chunk of this.groqService.streamResponse(userMessage, history)) {
        if (typeof chunk !== 'string') {
          continue;
        }
        const msgs = this.sessions.get(sessionId)!;
        msgs[msgs.length - 1].content += chunk;
        chunkCount += 1;
        if (chunkCount % SAVE_EVERY_N_CHUNKS === 0) this.saveChatSession(sessionId);
        yield chunk;
      }
    } finally {
      this.saveChatSession(sessionId);
    }
  }

  processMessageStreamWithMeta(sessionId: string, userMessage: string): {
    stream: AsyncGenerator<string>;
    meta: { sources: string[]; confidence: number };
  } {
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    const { stream, meta } = this.groqService.streamResponseWithMeta(userMessage, history);
    let chunkCount = 0;
    const self = this;

    async function* wrapped(): AsyncGenerator<string> {
      try {
        for await (const chunk of stream) {
          if (typeof chunk !== 'string') continue;
          const msgs = self.sessions.get(sessionId)!;
          msgs[msgs.length - 1].content += chunk;
          chunkCount += 1;
          if (chunkCount % SAVE_EVERY_N_CHUNKS === 0) self.saveChatSession(sessionId);
          yield chunk;
        }
      } finally {
        self.saveChatSession(sessionId);
      }
    }

    return { stream: wrapped(), meta };
  }

  async *processRealtimeMessageStream(
    sessionId: string,
    userMessage: string,
  ): AsyncGenerator<string | { _search_results: unknown }> {
    if (!this.realtimeService) throw new Error('Realtime service not initialized');
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    let chunkCount = 0;

    try {
      for await (const chunk of this.realtimeService.streamResponse(userMessage, history)) {
        if (typeof chunk === 'object') {
          yield chunk;
          continue;
        }
        const msgs = this.sessions.get(sessionId)!;
        msgs[msgs.length - 1].content += chunk;
        chunkCount += 1;
        if (chunkCount % SAVE_EVERY_N_CHUNKS === 0) this.saveChatSession(sessionId);
        yield chunk;
      }
    } finally {
      this.saveChatSession(sessionId);
    }
  }

  processRealtimeMessageStreamWithMeta(
    sessionId: string,
    userMessage: string,
  ): { stream: AsyncGenerator<string | { _search_results: unknown }>; meta: { sources: string[]; confidence: number } } {
    if (!this.realtimeService) throw new Error('Realtime service not initialized');
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    const { stream, meta } = this.realtimeService.streamResponseWithMeta(userMessage, history);
    let chunkCount = 0;
    const self = this;

    async function* wrapped(): AsyncGenerator<string | { _search_results: unknown }> {
      try {
        for await (const chunk of stream) {
          if (typeof chunk === 'object') {
            yield chunk;
            continue;
          }
          const msgs = self.sessions.get(sessionId)!;
          msgs[msgs.length - 1].content += chunk;
          chunkCount += 1;
          if (chunkCount % SAVE_EVERY_N_CHUNKS === 0) self.saveChatSession(sessionId);
          yield chunk;
        }
      } finally {
        self.saveChatSession(sessionId);
      }
    }

    return { stream: wrapped(), meta };
  }

  saveChatSession(sessionId: string): void {
    const messages = this.sessions.get(sessionId);
    if (!messages || messages.length === 0) return;

    const payload: ChatHistory = { session_id: sessionId, messages };
    fs.writeFileSync(this.sessionFilePath(sessionId), JSON.stringify(payload, null, 2), 'utf8');
  }

  saveAllSessions(): void {
    for (const sessionId of this.sessions.keys()) this.saveChatSession(sessionId);
  }
}
