import * as vscode from 'vscode';
import { IntentRouter, type SupportedIntent } from '../intelligence/intentRouter';

export interface CodeContextPayload {
  language: string;
  file_path: string;
  selection: string;
  file_content: string;
  workspace_root: string;
  session_id?: string;
  style_profile?: unknown;
  recent_edits?: string[];
  git_staged_diff?: string;
}

export interface CompletionResult {
  suggestions: string[];
  raw: string;
}

export interface AnalysisResult {
  mode: string;
  raw: string;
  findings: Array<{ title?: string; severity?: string; line?: number; details?: string; fix?: string }>;
  predicted_output?: string;
}

export interface SnippetResult {
  title?: string;
  prefix?: string;
  body?: string[];
  description?: string;
  raw: string;
}

export interface CommitMessageResult {
  message: string;
  raw: string;
}

export type AgentMode = 'casual' | 'strategic';

export interface StreamOptions {
  realtime: boolean;
  mode?: AgentMode;
}

function parseJsonBlock<T>(raw: string, fallback: T): T {
  const text = String(raw || '').trim();
  if (!text) return fallback;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() || text;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return fallback;
  }
}

function withModeHint(message: string, mode?: AgentMode): string {
  const text = String(message || '').trim();
  if (!mode) return text;
  if (mode === 'strategic') return `Switch to strategic mode\n${text}`;
  return `Switch to casual mode\n${text}`;
}

function chunkText(text: string, max = 120): string[] {
  const source = String(text || '');
  if (!source) return [];
  const out: string[] = [];
  for (let i = 0; i < source.length; i += max) {
    out.push(source.slice(i, i + max));
  }
  return out;
}

interface QueueTask {
  run: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (err: unknown) => void;
}

export class BackendClient {
  private readonly intentRouter = new IntentRouter();
  private queue: QueueTask[] = [];
  private active = false;
  private lastRequestAt = 0;
  private readonly minRequestGapMs = 180;
  private readonly defaultTimeoutMs = 30_000;

  constructor(private context: vscode.ExtensionContext) {}

  get baseUrl(): string {
    const cfg = vscode.workspace.getConfiguration();
    return String(cfg.get('astro.backendUrl', 'http://localhost:8000')).replace(/\/$/, '');
  }

  get sessionId(): string | undefined {
    return this.context.workspaceState.get<string>('astro.sessionId');
  }

  get agentMode(): AgentMode {
    const stored = this.context.workspaceState.get<string>('astro.agentMode');
    if (stored === 'casual' || stored === 'strategic') return stored;
    const cfg = vscode.workspace.getConfiguration();
    const conf = String(cfg.get('astro.agentDefaultMode', 'strategic')).toLowerCase();
    return conf === 'casual' ? 'casual' : 'strategic';
  }

  async setSessionId(sessionId?: string): Promise<void> {
    await this.context.workspaceState.update('astro.sessionId', sessionId);
  }

  async setAgentMode(mode: AgentMode): Promise<void> {
    await this.context.workspaceState.update('astro.agentMode', mode);
  }

  async sendRoutedMessage(
    message: string,
    options: StreamOptions,
    context: CodeContextPayload | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<{ response: string; sessionId?: string; intent: SupportedIntent; confidence: number }> {
    const decision = this.intentRouter.classify(message);
    if (decision.confidence < 70 || decision.intent === 'chat') {
      const fallback = await this.streamChat(message, options, onChunk);
      return { ...fallback, intent: 'chat', confidence: decision.confidence };
    }

    const payload = context ? { ...context, session_id: this.sessionId } : undefined;

    const emit = (text: string) => {
      for (const chunk of chunkText(text)) onChunk(chunk);
    };

    try {
      switch (decision.intent) {
        case 'explain': {
          if (!payload) break;
          const resp = await this.explainCode(payload);
          const text = String(resp?.summary || resp?.raw || resp || 'No response');
          emit(text);
          return { response: text, sessionId: this.sessionId, intent: decision.intent, confidence: decision.confidence };
        }
        case 'refactor': {
          if (!payload) break;
          const resp = await this.refactorCode(payload);
          const text = String(resp?.summary || resp?.raw || resp || 'No response');
          emit(text);
          return { response: text, sessionId: this.sessionId, intent: decision.intent, confidence: decision.confidence };
        }
        case 'fix': {
          if (!payload) break;
          const resp = await this.fixCode(payload);
          const text = String(resp?.summary || resp?.raw || resp || 'No response');
          emit(text);
          return { response: text, sessionId: this.sessionId, intent: decision.intent, confidence: decision.confidence };
        }
        case 'performance':
        case 'security':
        case 'analyze': {
          if (!payload) break;
          const mode = decision.intent === 'performance' ? 'performance' : decision.intent === 'security' ? 'security' : 'bug';
          const resp = await this.analyzeCode(mode, payload);
          const text = String(resp.raw || 'Analysis complete.');
          emit(text);
          return { response: text, sessionId: this.sessionId, intent: decision.intent, confidence: decision.confidence };
        }
        case 'generate_snippet': {
          if (!payload) break;
          const resp = await this.generateSnippet({
            request: message,
            language: payload.language,
            style_profile: payload.style_profile,
          });
          const text = Array.isArray(resp.body) && resp.body.length > 0 ? resp.body.join('\n') : String(resp.raw || 'Snippet generated.');
          emit(text);
          return { response: text, sessionId: this.sessionId, intent: decision.intent, confidence: decision.confidence };
        }
        case 'git_commit': {
          const diff = String(context?.git_staged_diff || '').trim();
          if (!diff) break;
          const resp = await this.suggestCommitMessage(diff);
          emit(resp.message);
          return { response: resp.message, sessionId: this.sessionId, intent: decision.intent, confidence: decision.confidence };
        }
        default:
          break;
      }
    } catch {
      // Fallback below.
    }

    const fallback = await this.streamChat(message, options, onChunk);
    return { ...fallback, intent: 'chat', confidence: Math.min(69, decision.confidence) };
  }

  async streamChat(message: string, options: StreamOptions, onChunk: (chunk: string) => void): Promise<{ response: string; sessionId?: string }> {
    const endpoint = options.realtime ? '/extension/chat/realtime/stream' : '/extension/chat/stream';
    const payloadMessage = withModeHint(message, options.mode);

    const res = await this.runQueued(() => this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payloadMessage,
        session_id: this.sessionId || null,
        shared_session: true,
        tts: false,
      }),
    }));

    if (!res.ok || !res.body) {
      throw new Error(`Chat stream failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let sid = this.sessionId;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (!raw.trim()) continue;
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          continue;
        }
        if (payload.session_id) sid = payload.session_id;
        if (payload.chunk) {
          full += payload.chunk;
          onChunk(payload.chunk);
        }
        if (payload.error) throw new Error(payload.error);
      }
    }

    if (sid) await this.setSessionId(sid);
    return { response: full, sessionId: sid };
  }

  async postJson<T>(endpoint: string, body: unknown): Promise<T> {
    return this.runQueued(async () => {
      const res = await this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`${endpoint} failed: HTTP ${res.status} ${detail}`);
      }
      return res.json() as Promise<T>;
    });
  }

  async planTask(input: { user_query: string; context?: any; forced_mode?: AgentMode }): Promise<any> {
    return this.postJson('/agent/plan', {
      user_query: input.user_query,
      context: input.context || {},
      forced_mode: input.forced_mode || this.agentMode,
      session_id: this.sessionId,
    });
  }

  async executeTask(input: {
    instruction: string;
    context?: any;
    forced_mode?: AgentMode;
    confirm?: boolean;
    overwrite?: boolean;
    destructive?: boolean;
    multi_file_count?: number;
  }): Promise<any> {
    const resp = await this.postJson<any>('/agent/execute', {
      instruction: input.instruction,
      context: input.context || {},
      forced_mode: input.forced_mode || this.agentMode,
      confirm: !!input.confirm,
      overwrite: !!input.overwrite,
      destructive: !!input.destructive,
      multi_file_count: Number(input.multi_file_count || 0),
      session_id: this.sessionId,
    });

    if (resp?.session_id) await this.setSessionId(resp.session_id);
    return resp;
  }

  async explainCode(payload: CodeContextPayload): Promise<any> {
    return this.postJson('/mentor/code/explain', payload);
  }

  async refactorCode(payload: CodeContextPayload): Promise<any> {
    return this.postJson('/mentor/code/refactor', payload);
  }

  async fixCode(payload: CodeContextPayload): Promise<any> {
    return this.postJson('/mentor/code/fix', payload);
  }

  async completeCode(payload: { language: string; prefix: string; suffix: string; style_profile?: unknown }): Promise<CompletionResult> {
    const resp = await this.postJson<{ session_id?: string; raw?: string; suggestions?: string[] }>('/mentor/code/complete', {
      ...payload,
      session_id: this.sessionId,
    });
    if (resp.session_id) await this.setSessionId(resp.session_id);
    const parsed = parseJsonBlock<{ suggestions?: string[] }>(String(resp.raw || ''), {});
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((x): x is string => typeof x === 'string' && !!x.trim())
      : Array.isArray(resp.suggestions)
        ? resp.suggestions.filter((x): x is string => typeof x === 'string' && !!x.trim())
        : [];

    return { suggestions, raw: String(resp.raw || '') };
  }

  async analyzeCode(mode: string, payload: CodeContextPayload): Promise<AnalysisResult> {
    const resp = await this.postJson<{ session_id?: string; mode: string; raw?: string; findings?: any[]; predicted_output?: string }>('/mentor/code/analyze', {
      mode,
      ...payload,
      session_id: this.sessionId,
    });
    if (resp.session_id) await this.setSessionId(resp.session_id);

    const parsed = parseJsonBlock<any>(String(resp.raw || ''), {});
    const findings = Array.isArray(parsed.findings)
      ? parsed.findings
      : Array.isArray(resp.findings)
        ? resp.findings
        : [];

    return {
      mode,
      raw: String(resp.raw || ''),
      findings,
      predicted_output: typeof parsed.predicted_output === 'string' ? parsed.predicted_output : resp.predicted_output,
    };
  }

  async generateSnippet(input: { request: string; language: string; style_profile?: unknown }): Promise<SnippetResult> {
    const resp = await this.postJson<{ session_id?: string; raw?: string }>('/mentor/snippet/generate', {
      ...input,
      session_id: this.sessionId,
    });
    if (resp.session_id) await this.setSessionId(resp.session_id);

    const parsed = parseJsonBlock<{ title?: string; prefix?: string; body?: string[]; description?: string }>(String(resp.raw || ''), {});
    return {
      title: parsed.title,
      prefix: parsed.prefix,
      body: Array.isArray(parsed.body) ? parsed.body : undefined,
      description: parsed.description,
      raw: String(resp.raw || ''),
    };
  }

  async suggestCommitMessage(diff: string): Promise<CommitMessageResult> {
    const resp = await this.postJson<{ session_id?: string; raw?: string }>('/mentor/git/commit-message', {
      diff,
      session_id: this.sessionId,
    });
    if (resp.session_id) await this.setSessionId(resp.session_id);

    const parsed = parseJsonBlock<{ type?: string; scope?: string; subject?: string; body?: string }>(String(resp.raw || ''), {});
    const header = `${parsed.type || 'chore'}${parsed.scope ? `(${parsed.scope})` : ''}: ${parsed.subject || 'update project'}`;
    const body = parsed.body ? `\n\n${parsed.body}` : '';
    return { message: `${header}${body}`, raw: String(resp.raw || '') };
  }

  async getEvolutionStatus(): Promise<any> {
    return this.runQueued(async () => {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/evolution/status`, {
        method: 'GET',
      });
      if (!res.ok) throw new Error(`/evolution/status failed: HTTP ${res.status}`);
      return res.json();
    });
  }

  async getCurriculumNext(): Promise<any> {
    return this.runQueued(async () => {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/curriculum/next`, {
        method: 'GET',
      });
      if (!res.ok) throw new Error(`/curriculum/next failed: HTTP ${res.status}`);
      return res.json();
    });
  }

  async getReflectionRecent(limit = 20): Promise<any> {
    return this.runQueued(async () => {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/reflection/recent?limit=${Math.max(1, Math.min(100, limit))}`, {
        method: 'GET',
      });
      if (!res.ok) throw new Error(`/reflection/recent failed: HTTP ${res.status}`);
      return res.json();
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = this.defaultTimeoutMs): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async runQueued<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: run as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      void this.drainQueue();
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift() as QueueTask;
        const wait = this.minRequestGapMs - (Date.now() - this.lastRequestAt);
        if (wait > 0) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, wait));
        }
        this.lastRequestAt = Date.now();
        try {
          // eslint-disable-next-line no-await-in-loop
          const out = await task.run();
          task.resolve(out);
        } catch (err) {
          task.reject(err);
        }
      }
    } finally {
      this.active = false;
    }
  }
}
