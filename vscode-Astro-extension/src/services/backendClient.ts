import * as vscode from 'vscode';

export interface CodeContextPayload {
  language: string;
  file_path: string;
  selection: string;
  file_content: string;
  workspace_root: string;
  session_id?: string;
  style_profile?: unknown;
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

export class BackendClient {
  constructor(private context: vscode.ExtensionContext) {}

  get baseUrl(): string {
    const cfg = vscode.workspace.getConfiguration();
    return String(cfg.get('astro.backendUrl', 'http://localhost:8000')).replace(/\/$/, '');
  }

  get sessionId(): string | undefined {
    return this.context.workspaceState.get<string>('astro.sessionId');
  }

  async setSessionId(sessionId?: string): Promise<void> {
    await this.context.workspaceState.update('astro.sessionId', sessionId);
  }

  async streamChat(message: string, realtime: boolean, onChunk: (chunk: string) => void): Promise<{ response: string; sessionId?: string }> {
    const endpoint = realtime ? '/chat/realtime/stream' : '/chat/stream';
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: this.sessionId,
        tts: false,
      }),
    });

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
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${endpoint} failed: HTTP ${res.status} ${detail}`);
    }
    return res.json() as Promise<T>;
  }

  async planTask(input: { user_query: string; context?: any }): Promise<any> {
    return this.postJson('/agent/plan', {
      user_query: input.user_query,
      context: input.context || {},
      session_id: this.sessionId,
    });
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
}
