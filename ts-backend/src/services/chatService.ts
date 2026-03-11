import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { BrainRouter } from '../core/agent/brain_router.js';
import { LearningScheduler } from '../learning/learning_scheduler.js';
import { ReasoningEngine } from '../reasoning/reasoning_engine.js';
import { CHATS_DATA_DIR, MAX_CHAT_HISTORY_TURNS } from '../config.js';
import { VectorMemoryStore } from '../memory/vector_store.js';
import type { ChatHistory, ChatMessage } from '../types/chat.js';
import type { MemoryService } from '../core/memory/memoryService.js';
import { GroqService } from './groqService.js';
import { RealtimeGroqService } from './realtimeService.js';
import { CodeAwarenessAgent } from '../code_awareness/codeAwarenessAgent.js';

const SAVE_EVERY_N_CHUNKS = 5;
type ChatPath = 'fast' | 'medium' | 'deep';

function splitChunks(text: string, size = 120): string[] {
  const src = String(text || '');
  if (!src) return [''];
  const out: string[] = [];
  for (let i = 0; i < src.length; i += size) out.push(src.slice(i, i + size));
  return out;
}

export class ChatService {
  private sessions = new Map<string, ChatMessage[]>();
  private readonly brainRouter: BrainRouter;
  private readonly vectorMemory = new VectorMemoryStore();
  private readonly codeAwarenessAgent = new CodeAwarenessAgent();

  constructor(
    private groqService: GroqService,
    private realtimeService?: RealtimeGroqService,
    private learningScheduler?: LearningScheduler,
    private reasoningEngine?: ReasoningEngine,
    private memoryService?: MemoryService,
  ) {
    this.brainRouter = new BrainRouter(groqService, realtimeService);
  }

  private capturePersonalFacts(userMessage: string): void {
    if (!this.memoryService) return;
    try {
      this.memoryService.capturePersonalFactsFromMessage(userMessage);
    } catch {
      // keep chat path resilient
    }
  }

  private withMemoryRecall(userMessage: string): string {
    if (!this.memoryService) return userMessage;
    try {
      const recall = this.memoryService.buildRecallContext(userMessage, 8);
      const rag = this.buildRagContext(userMessage);
      const sections: string[] = [];
      if (recall.facts.length) {
        sections.push('High-priority personal memory recall (apply naturally, do not expose raw internals):');
        sections.push(...recall.facts.map((fact) => `- ${fact}`));
        sections.push('');
      }
      if (rag) {
        sections.push(rag);
        sections.push('');
      }
      sections.push(`User request: ${userMessage}`);
      return sections.length ? sections.join('\n') : userMessage;
    } catch {
      return userMessage;
    }
  }

  private buildRagContext(userMessage: string, limit = 4): string | null {
    try {
      const embedding = this.vectorMemory.embed(userMessage);
      const hits = this.vectorMemory.similaritySearch(embedding, limit).filter((hit) => hit.text);
      if (!hits.length) return null;
      const contextLines = ['Retrieved memory context (apply naturally, avoid exposing sensitive IDs):'];
      for (const hit of hits) {
        const label = String(hit.metadata?.module || hit.metadata?.source || hit.metadata?.namespace || 'memory');
        contextLines.push(`- ${label}: ${hit.text.slice(0, 220)}`);
      }
      return contextLines.join('\n');
    } catch {
      return null;
    }
  }

  private isCodeAwarenessRequest(message: string): boolean {
    if (!message) return false;
    return /\b(code|architecture|module|folder|structure|refactor|design|system|feature)\b/i.test(message);
  }

  private isArchitectureRequest(message: string): boolean {
    if (!message) return false;
    return /\b(architecture|component|dependency|refactor|design|pattern)\b/i.test(message);
  }

  private isSelfUpgradeRequest(message: string): boolean {
    if (!message) return false;
    return /\b(upgrade|improve|self\s?modif|evolv|enhance|skill)\b/i.test(message);
  }

  private shouldAskStockClarification(message: string): boolean {
    if (!message) return false;
    const normalized = message.toLowerCase();
    if (!/\b(stock|share|index|nifty|sensex)\b/.test(normalized)) return false;
    if (!/\bprice\b/.test(normalized)) return false;
    if (/\b(nifty|sensex|nse|bse|spy|tsla|aapl|googl|nasdaq)\b/.test(normalized)) return false;
    return !/\b[A-Z]{2,5}\b/.test(message) || /\bka\b/.test(normalized);
  }

  private maybeEmitFriendlyWorkNote(sessionId: string, message: string): void {
    if (this.isCodeAwarenessRequest(message)) {
      this.addMessage(sessionId, 'assistant', 'Acha suno, main tumhare code ko deep scan kar raha hoon—thoda patience rakhna, tumhara loyal saathi detail laata hoon.');
      return;
    }
    if (this.isArchitectureRequest(message)) {
      this.addMessage(sessionId, 'assistant', 'Main architecture stack ko dekh raha hoon, jaise hi sab pakka hoga, ek friendly update de dunga.');
      return;
    }
    if (this.isSelfUpgradeRequest(message)) {
      this.addMessage(sessionId, 'assistant', 'System upgrade planning chal rahi hai—jaise hi sab clear ho, tumhare liye final plan le aata hoon.');
    }
  }

  private async buildCodeContext(sessionId: string, message: string): Promise<string | null> {
    if (!this.isCodeAwarenessRequest(message)) return null;
    let snapshot = this.codeAwarenessAgent.latestSnapshot();
    if (!snapshot) {
      this.addMessage(sessionId, 'assistant', 'Main tumhare code ko scan kar raha hoon, thodi der me detail bataunga...');
      snapshot = await this.codeAwarenessAgent.refresh().catch(() => null);
    }
    if (!snapshot) return null;
    const sampleModules = snapshot.modules.slice(0, 5).map((m) => m.module).filter(Boolean).join(', ') || 'n/a';
    const configList = snapshot.configs.length ? snapshot.configs.join(', ') : 'none';
    return [
      'Code awareness context (apply naturally):',
      `Modules: ${sampleModules}`,
      `Features implemented: ${snapshot.features.implemented.length}, missing: ${snapshot.features.missing.length}`,
      `Configs: ${configList}`,
    ].join('\n');
  }

  private classifyPath(userMessage: string): ChatPath {
    const raw = String(userMessage || '').trim();
    const q = raw.toLowerCase();
    const words = raw.split(/\s+/).filter(Boolean).length;

    const smallTalk = /^(hi|hii|hello|hey|yo|namaste|hlo|hola|how are you|kaise ho|kya haal)/i.test(q)
      || /\b(thanks|thank you|ok|okay|great|nice)\b/i.test(q);
    const heavySignals = /\b(research|latest|compare|benchmark|system design|architecture|multi-step|step by step|analy[sz]e|sources?)\b/i.test(q);
    const codingSignals = /\b(code|typescript|react|node|api|debug|bug|refactor|database)\b/i.test(q);

    if (smallTalk && words <= 14 && !heavySignals && !codingSignals) return 'fast';
    if (heavySignals || words > 42) return 'deep';
    return 'medium';
  }

  private async withTrace<T>(sessionId: string, userMessage: string, path: ChatPath, fn: () => Promise<T>): Promise<T> {
    const traceId = `${sessionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    return GroqService.withCallTrace(traceId, async () => {
      const out = await fn();
      const trace = GroqService.currentCallTrace();
      console.info(`[LLM_TRACE] session=${sessionId} path=${path} calls=${trace?.calls ?? 0} msg="${String(userMessage || '').slice(0, 80).replace(/\s+/g, ' ')}"`);
      return out;
    });
  }

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

    for (let i = 0; i < working.length - 1;) {
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
    const out = await this.processMessageWithMeta(sessionId, userMessage);
    return out.response;
  }

  async processMessageWithMeta(sessionId: string, userMessage: string): Promise<{ response: string; sources: string[]; confidence: number }> {
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const codeContextPromise = this.buildCodeContext(sessionId, userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.maybeEmitFriendlyWorkNote(sessionId, userMessage);
    if (this.shouldAskStockClarification(userMessage)) {
      const followUp = 'Boss, kis stock ka price chahiye?';
      this.addMessage(sessionId, 'assistant', followUp);
      return { response: followUp, sources: [], confidence: 0.5 };
    }
    const codeContext = await codeContextPromise;
    const history = this.formatHistoryForLlm(sessionId, true);
    const out = await this.withTrace(sessionId, userMessage, path, async () => {
      if (path === 'deep' && this.reasoningEngine) {
        const prep = await this.reasoningEngine.prepare(codeContext ? `${codeContext}\n\n${recalledMessage}` : recalledMessage);
        return this.brainRouter.route(prep.augmented_query || recalledMessage, history, {
          mode: 'general',
          preferResearch: prep.chosen_brain !== 'brain_a',
        });
      }
      return this.brainRouter.route(codeContext ? `${codeContext}\n\n${recalledMessage}` : recalledMessage, history, {
        mode: 'general',
        preferResearch: false,
      });
    });
    this.addMessage(sessionId, 'assistant', out.response);
    this.storeLearning(sessionId, userMessage, out.response, undefined, this.detectTags(userMessage));
    return { response: out.response, sources: out.meta.sources, confidence: out.meta.confidence };
  }

  async processRealtimeMessage(sessionId: string, userMessage: string): Promise<string> {
    const out = await this.processRealtimeMessageWithMeta(sessionId, userMessage);
    return out.response;
  }

  async processRealtimeMessageWithMeta(sessionId: string, userMessage: string): Promise<{ response: string; sources: string[]; confidence: number }> {
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const codeContext = await this.buildCodeContext(sessionId, userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    const history = this.formatHistoryForLlm(sessionId, true);
    const out = await this.withTrace(sessionId, userMessage, path, async () => {
      if (path === 'deep' && this.reasoningEngine) {
        const prep = await this.reasoningEngine.prepare(codeContext ? `${codeContext}\n\n${recalledMessage}` : recalledMessage);
        return this.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'general', preferResearch: true });
      }
      return this.brainRouter.route(codeContext ? `${codeContext}\n\n${recalledMessage}` : recalledMessage, history, { mode: 'general', preferResearch: false });
    });
    this.addMessage(sessionId, 'assistant', out.response);
    this.storeLearning(sessionId, userMessage, out.response, undefined, this.detectTags(userMessage));
    return { response: out.response, sources: out.meta.sources, confidence: out.meta.confidence };
  }

  async *processMessageStream(sessionId: string, userMessage: string): AsyncGenerator<string> {
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const codeContextPromise = this.buildCodeContext(sessionId, userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    let chunkCount = 0;

    try {
      const out = await this.withTrace(sessionId, userMessage, path, async () => {
        const context = await codeContextPromise;
        if (path === 'deep' && this.reasoningEngine) {
          const prep = await this.reasoningEngine.prepare(context ? `${context}\n\n${recalledMessage}` : recalledMessage);
          return this.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'general', preferResearch: prep.chosen_brain !== 'brain_a' });
        }
        return this.brainRouter.route(context ? `${context}\n\n${recalledMessage}` : recalledMessage, history, { mode: 'general', preferResearch: false });
      });
      this.storeLearning(sessionId, userMessage, out.response, undefined, this.detectTags(userMessage));
      for (const chunk of splitChunks(out.response)) {
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
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const codeContextPromise = this.buildCodeContext(sessionId, userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    const self = this;

    const meta = { sources: [] as string[], confidence: 0.5 };
    async function* wrapped(): AsyncGenerator<string> {
      let chunkCount = 0;
      try {
        const out = await self.withTrace(sessionId, userMessage, path, async () => {
          const context = await codeContextPromise;
          if (path === 'deep' && self.reasoningEngine) {
            const prep = await self.reasoningEngine.prepare(context ? `${context}\n\n${recalledMessage}` : recalledMessage);
            return self.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'general', preferResearch: prep.chosen_brain !== 'brain_a' });
          }
          return self.brainRouter.route(context ? `${context}\n\n${recalledMessage}` : recalledMessage, history, { mode: 'general', preferResearch: false });
        });
        self.storeLearning(sessionId, userMessage, out.response, undefined, self.detectTags(userMessage));
        meta.sources = out.meta.sources;
        meta.confidence = out.meta.confidence;
        for (const chunk of splitChunks(out.response)) {
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
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const codeContextPromise = this.buildCodeContext(sessionId, userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    let chunkCount = 0;

    try {
      const out = await this.withTrace(sessionId, userMessage, path, async () => {
        const context = await codeContextPromise;
        if (path === 'deep' && this.reasoningEngine) {
          const prep = await this.reasoningEngine.prepare(context ? `${context}\n\n${recalledMessage}` : recalledMessage);
          return this.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'general', preferResearch: true });
        }
        return this.brainRouter.route(context ? `${context}\n\n${recalledMessage}` : recalledMessage, history, { mode: 'general', preferResearch: false });
      });
      this.storeLearning(sessionId, userMessage, out.response, undefined, this.detectTags(userMessage));
      for (const chunk of splitChunks(out.response)) {
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
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    const self = this;

    const meta = { sources: [] as string[], confidence: 0.5 };
    async function* wrapped(): AsyncGenerator<string | { _search_results: unknown }> {
      let chunkCount = 0;
      try {
        const out = await self.withTrace(sessionId, userMessage, path, async () => {
          if (path === 'deep' && self.reasoningEngine) {
            const prep = await self.reasoningEngine.prepare(recalledMessage);
            return self.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'general', preferResearch: true });
          }
          return self.brainRouter.route(recalledMessage, history, { mode: 'general', preferResearch: false });
        });
        self.storeLearning(sessionId, userMessage, out.response, undefined, self.detectTags(userMessage));
        meta.sources = out.meta.sources;
        meta.confidence = out.meta.confidence;
        for (const chunk of splitChunks(out.response)) {
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

  processExtensionCodeMessageStreamWithMeta(sessionId: string, userMessage: string): {
    stream: AsyncGenerator<string>;
    meta: { sources: string[]; confidence: number };
  } {
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    const self = this;

    const meta = { sources: [] as string[], confidence: 0.5 };
    async function* wrapped(): AsyncGenerator<string> {
      let chunkCount = 0;
      try {
        const out = await self.withTrace(sessionId, userMessage, path, async () => {
          if (path === 'deep' && self.reasoningEngine) {
            const prep = await self.reasoningEngine.prepare(recalledMessage);
            return self.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'extension', preferResearch: prep.chosen_brain !== 'brain_a' });
          }
          return self.brainRouter.route(recalledMessage, history, { mode: 'extension', preferResearch: false });
        });
        self.storeLearning(sessionId, userMessage, out.response, userMessage.slice(0, 1500), self.detectTags(userMessage, true));
        meta.sources = out.meta.sources;
        meta.confidence = out.meta.confidence;
        for (const chunk of splitChunks(out.response)) {
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

  processExtensionCodeRealtimeMessageStreamWithMeta(
    sessionId: string,
    userMessage: string,
  ): { stream: AsyncGenerator<string | { _search_results: unknown }>; meta: { sources: string[]; confidence: number } } {
    this.capturePersonalFacts(userMessage);
    const recalledMessage = this.withMemoryRecall(userMessage);
    const path = this.classifyPath(userMessage);
    this.addMessage(sessionId, 'user', userMessage);
    this.addMessage(sessionId, 'assistant', '');
    const history = this.formatHistoryForLlm(sessionId, true);
    const self = this;

    const meta = { sources: [] as string[], confidence: 0.5 };
    async function* wrapped(): AsyncGenerator<string | { _search_results: unknown }> {
      let chunkCount = 0;
      try {
        const out = await self.withTrace(sessionId, userMessage, path, async () => {
          if (path === 'deep' && self.reasoningEngine) {
            const prep = await self.reasoningEngine.prepare(recalledMessage);
            return self.brainRouter.route(prep.augmented_query || recalledMessage, history, { mode: 'extension', preferResearch: true });
          }
          return self.brainRouter.route(recalledMessage, history, { mode: 'extension', preferResearch: false });
        });
        self.storeLearning(sessionId, userMessage, out.response, userMessage.slice(0, 1500), self.detectTags(userMessage, true));
        meta.sources = out.meta.sources;
        meta.confidence = out.meta.confidence;
        for (const chunk of splitChunks(out.response)) {
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

  private detectTopic(text: string): string {
    const t = String(text || '').toLowerCase();
    if (/\breact|frontend|component|hook\b/.test(t)) return 'react';
    if (/\bapi|endpoint|rest|graphql\b/.test(t)) return 'api';
    if (/\bdb|database|sql|postgres|redis\b/.test(t)) return 'database';
    if (/\barchitecture|system design|scalable|distributed\b/.test(t)) return 'system_design';
    if (/\bbug|fix|error|exception|trace\b/.test(t)) return 'debugging';
    if (/\bdsa|algorithm|complexity|big-?o\b/.test(t)) return 'dsa';
    return 'general';
  }

  private detectTags(text: string, extension = false): string[] {
    const t = String(text || '').toLowerCase();
    const tags = new Set<string>(extension ? ['coding', 'extension'] : ['chat']);
    if (/\bai|llm|agent|prompt\b/.test(t)) tags.add('ai');
    if (/\bcode|typescript|javascript|python|bug|refactor\b/.test(t)) tags.add('coding');
    if (/\bsystem design|architecture|scalable|distributed\b/.test(t)) tags.add('system_design');
    if (/\bresearch|source|documentation\b/.test(t)) tags.add('research');
    return Array.from(tags);
  }

  private storeLearning(sessionId: string, userMessage: string, assistantResponse: string, codingContext?: string, tags?: string[]): void {
    if (!this.learningScheduler) return;
    this.learningScheduler.storeConversation({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      user_message: userMessage,
      assistant_response: assistantResponse,
      detected_topic: this.detectTopic(userMessage),
      coding_context: codingContext,
      tags: tags || this.detectTags(userMessage),
    });
  }
}
