import { Router } from 'express';
import type { MemoryService } from '../core/memory/memoryService.js';
import type { AuditService } from '../core/safety/auditService.js';
import type { SafetyService } from '../core/safety/safetyService.js';
import { AllGroqApisFailedError } from '../services/groqService.js';
import type { ChatService } from '../services/chatService.js';

function safeText(value: unknown, max = 6000): string {
  return String(value || '').slice(0, max);
}

function makeMentorPrompt(mode: 'explain' | 'refactor' | 'fix', payload: any): string {
  const section = mode === 'explain'
    ? 'Explain the selected code in practical terms.'
    : mode === 'refactor'
      ? 'Suggest a better refactor and provide a concise rationale.'
      : 'Find likely bug(s) and propose a fix with rationale.';

  return [
    'You are Astro, a senior developer mentor.',
    'Return concise, practical output.',
    'Always include: summary, rationale, and concrete next action.',
    section,
    '',
    `Language: ${payload.language || 'unknown'}`,
    `File: ${payload.file_path || 'unknown'}`,
    '',
    'Selected Code:',
    payload.selection || '(empty selection)',
    '',
    'File Context (truncated if long):',
    safeText(payload.file_content),
  ].join('\n');
}

async function askMentor(chatService: ChatService, sid: string, prompt: string): Promise<string> {
  const response = await chatService.processMessage(sid, prompt);
  chatService.saveChatSession(sid);
  return response;
}

function styleProfileText(profile: unknown): string {
  if (!profile) return 'none';
  try {
    return JSON.stringify(profile);
  } catch {
    return 'unserializable';
  }
}

function parseJson<T>(raw: string, fallback: T): T {
  const text = String(raw || '').trim();
  if (!text) return fallback;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] || text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return fallback;
  }
}

export function createExtensionRouter(deps: {
  getChatService: () => ChatService;
  memoryService: MemoryService;
  auditService: AuditService;
  safetyService: SafetyService;
}): Router {
  const router = Router();

  const withAudit = (route: string, action: string, handler: (body: any) => Promise<{ statusCode?: number; payload: any; sessionId?: string }>) => {
    return async (req: any, res: any) => {
      const body = req.body || {};
      const sessionId = body.session_id ? String(body.session_id) : undefined;

      try {
        const result = await handler(body);
        const statusCode = result.statusCode || 200;
        const status = statusCode >= 400 ? 'blocked' : 'allowed';
        deps.auditService.log({
          ts: new Date().toISOString(),
          route,
          action,
          status,
          session_id: result.sessionId || sessionId,
          details: { statusCode },
        });
        return res.status(statusCode).json(result.payload);
      } catch (err) {
        const statusCode = err instanceof AllGroqApisFailedError ? 503 : 500;
        deps.auditService.log({
          ts: new Date().toISOString(),
          route,
          action,
          status: 'error',
          session_id: sessionId,
          details: { error: String(err) },
        });
        return res.status(statusCode).json({ detail: err instanceof AllGroqApisFailedError ? err.message : String(err) });
      }
    };
  };

  router.post('/agent/plan', withAudit('/agent/plan', 'plan', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const userQuery = String(body.user_query || '').trim();
    if (!userQuery) return { statusCode: 400, payload: { detail: 'user_query is required' }, sessionId: sid };

    const plannerPrompt = [
      'Create a compact, execution-ready plan.',
      'Return valid JSON only with keys: goal, steps, risks, success_criteria, tools.',
      'Each step must contain: id, title, action, expected_output.',
      `Task: ${userQuery}`,
      `Context: ${JSON.stringify(body.context || {})}`,
    ].join('\n');

    const response = await askMentor(chatService, sid, plannerPrompt);
    return {
      payload: {
        session_id: sid,
        goal: userQuery,
        raw_plan: response,
        tools: ['chat', 'mentor', 'rag'],
      },
      sessionId: sid,
    };
  }));

  router.post('/agent/execute', withAudit('/agent/execute', 'execute', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const instruction = String(body.instruction || '').trim();
    if (!instruction) return { statusCode: 400, payload: { detail: 'instruction is required' }, sessionId: sid };

    const safeInstruction = deps.safetyService.isInstructionSafe(instruction);
    if (!safeInstruction.allowed) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/agent/execute',
        action: 'execute',
        status: 'blocked',
        session_id: sid,
        details: { reason: safeInstruction.reason },
      });
      return { statusCode: 403, payload: { detail: safeInstruction.reason }, sessionId: sid };
    }

    const ctx = body.context || {};
    const safePath = deps.safetyService.isFilePathAllowed(ctx.file_path, ctx.workspace_root);
    if (!safePath.allowed) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/agent/execute',
        action: 'execute',
        status: 'blocked',
        session_id: sid,
        details: { reason: safePath.reason },
      });
      return { statusCode: 403, payload: { detail: safePath.reason }, sessionId: sid };
    }

    const response = await askMentor(
      chatService,
      sid,
      `Execute this task safely and provide actionable feedback:\n${instruction}\n\nContext:\n${JSON.stringify(ctx)}`,
    );

    return { payload: { session_id: sid, result: response, status: 'completed' }, sessionId: sid };
  }));

  router.post('/mentor/code/explain', withAudit('/mentor/code/explain', 'mentor_explain', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);

    const safePath = deps.safetyService.isFilePathAllowed(body.file_path, body.workspace_root);
    if (!safePath.allowed) return { statusCode: 403, payload: { detail: safePath.reason }, sessionId: sid };

    const response = await askMentor(chatService, sid, makeMentorPrompt('explain', body));
    return {
      payload: {
        session_id: sid,
        mode: 'explain',
        summary: response,
        rationale: 'Generated from selected code + file context.',
      },
      sessionId: sid,
    };
  }));

  router.post('/mentor/code/refactor', withAudit('/mentor/code/refactor', 'mentor_refactor', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);

    const safePath = deps.safetyService.isFilePathAllowed(body.file_path, body.workspace_root);
    if (!safePath.allowed) return { statusCode: 403, payload: { detail: safePath.reason }, sessionId: sid };

    const prompt = `${makeMentorPrompt('refactor', body)}\n\nAlso append a PATCH block in unified-diff style if possible.`;
    const response = await askMentor(chatService, sid, prompt);

    return {
      payload: {
        session_id: sid,
        mode: 'refactor',
        summary: response,
        suggested_patch: response,
        rationale: 'Refactor suggestion generated by mentor mode.',
      },
      sessionId: sid,
    };
  }));

  router.post('/mentor/code/fix', withAudit('/mentor/code/fix', 'mentor_fix', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);

    const safePath = deps.safetyService.isFilePathAllowed(body.file_path, body.workspace_root);
    if (!safePath.allowed) return { statusCode: 403, payload: { detail: safePath.reason }, sessionId: sid };

    const prompt = `${makeMentorPrompt('fix', body)}\n\nAlso append a PATCH block in unified-diff style if possible.`;
    const response = await askMentor(chatService, sid, prompt);

    return {
      payload: {
        session_id: sid,
        mode: 'fix',
        summary: response,
        suggested_patch: response,
        rationale: 'Fix suggestion generated by mentor mode.',
      },
      sessionId: sid,
    };
  }));

  router.post('/mentor/code/complete', withAudit('/mentor/code/complete', 'mentor_complete', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const language = String(body.language || 'unknown');
    const prefix = safeText(body.prefix, 2500);
    const suffix = safeText(body.suffix, 1200);

    const prompt = [
      'You are Astro autocomplete engine.',
      'Return valid JSON only with key: suggestions (array of up to 3 strings).',
      'Keep suggestions short, syntactically valid, and context-aware.',
      `Language: ${language}`,
      `Style profile: ${styleProfileText(body.style_profile)}`,
      'Prefix:',
      prefix,
      'Suffix:',
      suffix,
    ].join('\n');

    const raw = await askMentor(chatService, sid, prompt);
    const parsed = parseJson<{ suggestions?: string[] }>(raw, {});

    return {
      payload: {
        session_id: sid,
        raw,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      },
      sessionId: sid,
    };
  }));

  router.post('/mentor/code/analyze', withAudit('/mentor/code/analyze', 'mentor_analyze', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const mode = String(body.mode || 'general');

    const prompt = [
      'You are Astro code analyzer.',
      'Return valid JSON only.',
      'Expected keys by mode:',
      '- security/performance/bug/refactor: findings (array of {title,severity,line,details,fix})',
      '- docs: summary, docstring, readme_section',
      '- output_preview: predicted_output, assumptions, confidence',
      '- api_db: contracts, queries, schema_notes, risks',
      `Mode: ${mode}`,
      `Language: ${body.language || 'unknown'}`,
      `File: ${body.file_path || 'unknown'}`,
      `Style profile: ${styleProfileText(body.style_profile)}`,
      'Selection:',
      safeText(body.selection, 4000),
      'File Content:',
      safeText(body.file_content, 7000),
    ].join('\n');

    const raw = await askMentor(chatService, sid, prompt);
    const parsed = parseJson<{ findings?: any[]; predicted_output?: string }>(raw, {});

    return {
      payload: {
        session_id: sid,
        mode,
        raw,
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        predicted_output: typeof parsed.predicted_output === 'string' ? parsed.predicted_output : undefined,
      },
      sessionId: sid,
    };
  }));

  router.post('/mentor/snippet/generate', withAudit('/mentor/snippet/generate', 'mentor_snippet', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const request = String(body.request || '').trim();
    if (!request) return { statusCode: 400, payload: { detail: 'request is required' }, sessionId: sid };

    const prompt = [
      'You are Astro snippet generator.',
      'Return valid JSON only with keys: title, prefix, body (array of lines), description.',
      `Language: ${body.language || 'unknown'}`,
      `Request: ${request}`,
      `Style profile: ${styleProfileText(body.style_profile)}`,
    ].join('\n');

    const raw = await askMentor(chatService, sid, prompt);
    return { payload: { session_id: sid, raw }, sessionId: sid };
  }));

  router.post('/mentor/git/commit-message', withAudit('/mentor/git/commit-message', 'mentor_git', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const diff = safeText(body.diff, 12000);
    if (!diff.trim()) return { statusCode: 400, payload: { detail: 'diff is required' }, sessionId: sid };

    const prompt = [
      'You are Astro git assistant.',
      'Write one clear commit message in Conventional Commits style.',
      'Return valid JSON only with keys: type, scope, subject, body.',
      'Diff:',
      diff,
    ].join('\n');

    const raw = await askMentor(chatService, sid, prompt);
    return { payload: { session_id: sid, raw }, sessionId: sid };
  }));

  router.post('/memory/upsert', withAudit('/memory/upsert', 'memory_upsert', async (body) => {
    if (typeof body.value === 'undefined') {
      return { statusCode: 400, payload: { detail: 'value is required' } };
    }

    const record = deps.memoryService.upsert({
      namespace: body.namespace,
      key: body.key,
      value: body.value,
      tags: body.tags,
    });

    return { payload: { status: 'ok', record } };
  }));

  router.get('/memory/profile', (_req, res) => {
    try {
      const payload = deps.memoryService.profile();
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/memory/profile',
        action: 'memory_profile',
        status: 'allowed',
      });
      return res.json(payload);
    } catch (err) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/memory/profile',
        action: 'memory_profile',
        status: 'error',
        details: { error: String(err) },
      });
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/audit/recent', (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const logs = deps.auditService.recent(limit);
    return res.json({ count: logs.length, logs });
  });

  return router;
}
