import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { LEARNING_DATA_DIR } from '../config.js';
import type { MemoryService } from '../core/memory/memoryService.js';
import type { AuditService } from '../core/safety/auditService.js';
import type { SafetyService } from '../core/safety/safetyService.js';
import type { AgentController } from '../core/agent/controller.js';
import { AllGroqApisFailedError } from '../services/groqService.js';
import type { ChatService } from '../services/chatService.js';
import type { VoiceService } from '../core/voice/voiceService.js';

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
  getAgentController: () => AgentController;
  memoryService: MemoryService;
  auditService: AuditService;
  safetyService: SafetyService;
  voiceService: VoiceService;
}): Router {
  const router = Router();
  const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');

  const sanitizeLearningFileName = (input: unknown): string => {
    const name = String(input || '').trim();
    if (!name) return '';
    if (!/^[a-zA-Z0-9_.-]+\.txt$/.test(name)) return '';
    return name;
  };

  const resolveLearningFilePath = (name: string): string | null => {
    const safeName = sanitizeLearningFileName(name);
    if (!safeName) return null;
    const fullPath = path.resolve(LEARNING_DATA_DIR, safeName);
    if (!fullPath.startsWith(path.resolve(LEARNING_DATA_DIR))) return null;
    return fullPath;
  };

  const sanitizeWorkspaceRelativePath = (input: unknown): string => {
    const rel = String(input || '').trim().replace(/\\/g, '/');
    if (!rel) return '';
    if (rel.startsWith('/') || rel.includes('..')) return '';
    if (rel.includes('\0')) return '';
    return rel;
  };

  const resolveWorkspacePath = (relativePath: string): string | null => {
    const safe = sanitizeWorkspaceRelativePath(relativePath);
    if (!safe) return null;
    const abs = path.resolve(WORKSPACE_ROOT, safe);
    if (!abs.startsWith(WORKSPACE_ROOT + path.sep) && abs !== WORKSPACE_ROOT) return null;
    return abs;
  };

  const isEditableTextFile = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase();
    const allow = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml',
      '.css', '.html', '.env', '.sh', '.py', '.toml', '.ini', '.xml',
    ]);
    return allow.has(ext) || path.basename(filePath).startsWith('.env');
  };

  const listWorkspaceFiles = (subdir = '', limit = 400): string[] => {
    const resolved = subdir ? resolveWorkspacePath(subdir) : WORKSPACE_ROOT;
    if (!resolved || !fs.existsSync(resolved)) return [];
    const files: string[] = [];
    const queue: string[] = [resolved];
    const max = Math.max(1, Math.min(2000, limit));

    while (queue.length > 0 && files.length < max) {
      const cur = queue.shift()!;
      const entries = fs.readdirSync(cur, { withFileTypes: true });
      for (const entry of entries) {
        const abs = path.join(cur, entry.name);
        const rel = path.relative(WORKSPACE_ROOT, abs).replace(/\\/g, '/');
        if (!rel || rel.startsWith('.git/') || rel.includes('/.git/') || rel.startsWith('node_modules/') || rel.includes('/node_modules/')) continue;
        if (entry.isDirectory()) {
          queue.push(abs);
          continue;
        }
        if (!isEditableTextFile(abs)) continue;
        files.push(rel);
        if (files.length >= max) break;
      }
    }
    return files.sort();
  };

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

    const contract = deps.getAgentController().buildInternalContract(userQuery, body.forced_mode);

    return {
      payload: {
        session_id: sid,
        goal: contract.plan.goal,
        plan: contract.plan,
        internal_contract: {
          intent: contract.intent,
          complexity_score: contract.complexity_score,
          ambiguity_score: contract.ambiguity_score,
          selected_mode: contract.selected_mode,
        },
        raw_plan: JSON.stringify(contract.plan),
        tools: contract.plan.tools,
      },
      sessionId: sid,
    };
  }));

  router.post('/agent/execute', withAudit('/agent/execute', 'execute', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);
    const instruction = String(body.instruction || '').trim();
    if (!instruction) return { statusCode: 400, payload: { detail: 'instruction is required' }, sessionId: sid };

    const ctx = body.context || {};

    const pathSafety = deps.safetyService.isFilePathAllowed(ctx.file_path, ctx.workspace_root);
    if (!pathSafety.allowed) {
      return { statusCode: 403, payload: { detail: pathSafety.reason }, sessionId: sid };
    }

    const decision = deps.getAgentController().checkAction('execute', {
      intent: instruction,
      confirm: Boolean(body.confirm),
      destructive: Boolean(body.destructive),
      overwrite: Boolean(body.overwrite),
      multiFileCount: Number(body.multi_file_count || 0),
    });

    if (!decision.allowed) {
      return {
        statusCode: decision.needs_confirmation ? 409 : 403,
        payload: {
          detail: decision.reason,
          needs_confirmation: decision.needs_confirmation,
        },
        sessionId: sid,
      };
    }

    const result = await deps.getAgentController().run({
      sessionId: sid,
      message: instruction,
      context: { ...ctx, confirm: !!body.confirm },
      confirm: !!body.confirm,
      forcedMode: body.forced_mode,
    });

    if (result.evaluation.clarification_required) {
      return {
        payload: {
          session_id: sid,
          status: 'clarification_required',
          clarification_question: result.clarification_question,
          contract: result.contract,
          evaluation: result.evaluation,
          step_results: result.step_results,
        },
        sessionId: sid,
      };
    }

    return {
      payload: {
        session_id: sid,
        result: result.outcome_text,
        status: 'completed',
        contract: result.contract,
        evaluation: result.evaluation,
        step_results: result.step_results,
      },
      sessionId: sid,
    };
  }));

  router.post('/mentor/code/explain', withAudit('/mentor/code/explain', 'mentor_explain', async (body) => {
    const chatService = deps.getChatService();
    const sid = chatService.getOrCreateSession(body.session_id);

    const safePath = deps.safetyService.isFilePathAllowed(body.file_path, body.workspace_root);
    if (!safePath.allowed) return { statusCode: 403, payload: { detail: safePath.reason }, sessionId: sid };

    deps.memoryService.trackCodingStyle({ text: `${body.selection || ''}
${body.file_content || ''}` });

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

    deps.memoryService.trackCodingStyle({ text: `${body.selection || ''}\n${body.file_content || ''}` });

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

    deps.memoryService.trackCodingStyle({ text: `${body.selection || ''}\n${body.file_content || ''}` });
    const antiPattern = deps.memoryService.recordAntiPatternFromText(`${body.selection || ''}\n${body.file_content || ''}`);

    const prompt = `${makeMentorPrompt('fix', body)}\n\nAlso append a PATCH block in unified-diff style if possible.\nTracked anti-pattern: ${antiPattern.pattern} (count=${antiPattern.count})`;
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

    deps.memoryService.trackCodingStyle({ text: `${body.selection || ''}\n${body.file_content || ''}` });
    if (mode === 'bug' || mode === 'performance' || mode === 'security') {
      deps.memoryService.recordAntiPatternFromText(`${body.selection || ''}\n${body.file_content || ''}`);
    }
    deps.memoryService.updateSkillProgressFromText(`${mode} ${body.selection || ''}`);

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

  router.get('/learning/file', (req, res) => {
    const name = sanitizeLearningFileName(req.query.name);
    if (!name) return res.status(400).json({ detail: 'valid txt file name is required' });

    const filePath = resolveLearningFilePath(name);
    if (!filePath) return res.status(400).json({ detail: 'invalid file path' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ detail: 'file not found' });

    try {
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/learning/file',
        action: 'learning_file_read',
        status: 'allowed',
        details: { name },
      });
      return res.json({ name, content, bytes: stat.size, updated_at: stat.mtime.toISOString() });
    } catch (err) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/learning/file',
        action: 'learning_file_read',
        status: 'error',
        details: { name, error: String(err) },
      });
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/workspace/files', (req, res) => {
    try {
      const dir = String(req.query.dir || '').trim();
      const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 400)));
      const files = listWorkspaceFiles(dir, limit);
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/workspace/files',
        action: 'workspace_files_list',
        status: 'allowed',
        details: { dir, count: files.length },
      });
      return res.json({ status: 'ok', root: WORKSPACE_ROOT, count: files.length, files });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/workspace/file', (req, res) => {
    const relPath = String(req.query.path || '').trim();
    const abs = resolveWorkspacePath(relPath);
    if (!abs) return res.status(400).json({ detail: 'invalid workspace path' });
    if (!fs.existsSync(abs)) return res.status(404).json({ detail: 'file not found' });
    if (!isEditableTextFile(abs)) return res.status(400).json({ detail: 'file type not editable via API' });

    const safety = deps.safetyService.isFilePathAllowed(abs, WORKSPACE_ROOT);
    if (!safety.allowed) return res.status(403).json({ detail: safety.reason });

    try {
      const stat = fs.statSync(abs);
      if (stat.size > 2 * 1024 * 1024) return res.status(400).json({ detail: 'file too large (>2MB)' });
      const content = fs.readFileSync(abs, 'utf8');
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/workspace/file',
        action: 'workspace_file_read',
        status: 'allowed',
        details: { path: relPath, bytes: stat.size },
      });
      return res.json({ status: 'ok', path: relPath, content, bytes: stat.size, updated_at: stat.mtime.toISOString() });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.put('/learning/file', (req, res) => {
    const name = sanitizeLearningFileName(req.body?.name);
    const content = String(req.body?.content || '');
    if (!name) return res.status(400).json({ detail: 'valid txt file name is required' });

    const filePath = resolveLearningFilePath(name);
    if (!filePath) return res.status(400).json({ detail: 'invalid file path' });

    try {
      fs.writeFileSync(filePath, content, 'utf8');
      const stat = fs.statSync(filePath);
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/learning/file',
        action: 'learning_file_write',
        status: 'allowed',
        details: { name, bytes: stat.size },
      });
      return res.json({ status: 'ok', name, bytes: stat.size, updated_at: stat.mtime.toISOString() });
    } catch (err) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/learning/file',
        action: 'learning_file_write',
        status: 'error',
        details: { name, error: String(err) },
      });
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.put('/workspace/file', (req, res) => {
    const relPath = String(req.body?.path || '').trim();
    const content = String(req.body?.content || '');
    const abs = resolveWorkspacePath(relPath);
    if (!abs) return res.status(400).json({ detail: 'invalid workspace path' });
    if (!isEditableTextFile(abs)) return res.status(400).json({ detail: 'file type not editable via API' });

    const safety = deps.safetyService.isFilePathAllowed(abs, WORKSPACE_ROOT);
    if (!safety.allowed) return res.status(403).json({ detail: safety.reason });

    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
      const stat = fs.statSync(abs);
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/workspace/file',
        action: 'workspace_file_write',
        status: 'allowed',
        details: { path: relPath, bytes: stat.size },
      });
      return res.json({ status: 'ok', path: relPath, bytes: stat.size, updated_at: stat.mtime.toISOString() });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/voice/settings', (_req, res) => {
    try {
      const payload = deps.voiceService.getPublicSettings();
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/voice/settings',
        action: 'voice_settings_read',
        status: 'allowed',
      });
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.put('/voice/settings', (req, res) => {
    try {
      const payload = deps.voiceService.setActive({
        active_source: req.body?.active_source === 'custom' ? 'custom' : 'edge',
        active_voice_id: req.body?.active_voice_id,
        edge_voice: req.body?.edge_voice,
        rate: req.body?.rate,
      });
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/voice/settings',
        action: 'voice_settings_write',
        status: 'allowed',
        details: { active_source: payload.active_source, active_voice_id: payload.active_voice_id },
      });
      return res.json({ status: 'ok', settings: payload });
    } catch (err) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/voice/settings',
        action: 'voice_settings_write',
        status: 'error',
        details: { error: String(err) },
      });
      return res.status(400).json({ detail: String(err) });
    }
  });

  router.post('/voice/custom', (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ detail: 'name is required' });

      const voice = deps.voiceService.createOrUpdateCustomVoice({
        name,
        edge_voice: req.body?.edge_voice,
        rate: req.body?.rate,
        sample_base64: req.body?.sample_base64,
        sample_mime: req.body?.sample_mime,
      });

      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/voice/custom',
        action: 'voice_custom_create',
        status: 'allowed',
        details: { id: voice.id, edge_voice: voice.edge_voice },
      });
      return res.json({ status: 'ok', voice });
    } catch (err) {
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/voice/custom',
        action: 'voice_custom_create',
        status: 'error',
        details: { error: String(err) },
      });
      return res.status(400).json({ detail: String(err) });
    }
  });

  router.get('/audit/recent', (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const logs = deps.auditService.recent(limit);
    return res.json({ count: logs.length, logs });
  });

  router.get('/evolution/status', (_req, res) => {
    try {
      const status = deps.getAgentController().getEvolutionStatus();
      return res.json({ status: 'ok', ...status });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/reflection/recent', (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
      const status = deps.getAgentController().getEvolutionStatus();
      return res.json({ status: 'ok', count: Math.min(limit, status.recent_reflections.length), reviews: status.recent_reflections.slice(0, limit) });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/curriculum/next', (_req, res) => {
    try {
      const status = deps.getAgentController().getEvolutionStatus();
      return res.json({
        status: 'ok',
        next_task: status.next_task,
        suggested_resources: status.suggested_resources,
      });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/skills/list', (_req, res) => {
    try {
      const skills = deps.getAgentController().listSkills();
      return res.json({ status: 'ok', count: skills.length, skills });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.get('/skills/detail/:skill_id', (req, res) => {
    try {
      const skillId = String(req.params.skill_id || '').trim().toLowerCase();
      if (!skillId) return res.status(400).json({ detail: 'skill_id is required' });
      const details = deps.getAgentController().getSkillDetails(skillId);
      if (!details) return res.status(404).json({ detail: 'skill not found' });
      return res.json({ status: 'ok', ...details });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.put('/skills/toggle', (req, res) => {
    try {
      const skillId = String(req.body?.skill_id || '').trim().toLowerCase();
      const enabled = Boolean(req.body?.enabled);
      if (!skillId) return res.status(400).json({ detail: 'skill_id is required' });
      const updated = deps.getAgentController().setSkillEnabled(skillId, enabled);
      if (!updated) return res.status(404).json({ detail: 'skill not found' });
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/skills/toggle',
        action: 'skill_toggle',
        status: 'allowed',
        details: { skill_id: skillId, enabled },
      });
      return res.json({ status: 'ok', skill: updated });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.post('/skills/learn', (req, res) => {
    try {
      const task = String(req.body?.task || '').trim();
      if (!task) return res.status(400).json({ detail: 'task is required' });
      const learned = deps.getAgentController().learnSkill({
        task,
        conversation: String(req.body?.conversation || ''),
        assistantResponse: String(req.body?.assistant_response || ''),
      });
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/skills/learn',
        action: 'skill_learn',
        status: 'allowed',
        details: { task: task.slice(0, 180), detected: learned.detected },
      });
      return res.json({ status: 'ok', ...learned });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.post('/skills/evolve', (req, res) => {
    try {
      const skillId = String(req.body?.skill_id || '').trim().toLowerCase();
      const result = String(req.body?.result || '').trim().toLowerCase() as 'success' | 'partial' | 'failure';
      const notes = String(req.body?.notes || '');
      if (!skillId) return res.status(400).json({ detail: 'skill_id is required' });
      if (!['success', 'partial', 'failure'].includes(result)) return res.status(400).json({ detail: 'result must be success|partial|failure' });
      const updated = deps.getAgentController().evolveSkill(skillId, result, notes);
      if (!updated) return res.status(404).json({ detail: 'skill not found' });
      deps.auditService.log({
        ts: new Date().toISOString(),
        route: '/skills/evolve',
        action: 'skill_evolve',
        status: 'allowed',
        details: { skill_id: skillId, result },
      });
      return res.json({ status: 'ok', skill: updated });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  router.post('/skills/execute', (req, res) => {
    try {
      const skillId = String(req.body?.skill_id || '').trim().toLowerCase();
      const message = String(req.body?.message || '').trim();
      if (!skillId || !message) return res.status(400).json({ detail: 'skill_id and message are required' });
      const result = deps.getAgentController().runSkill(skillId, { message, context: req.body?.context || {} });
      if (!result) return res.status(404).json({ detail: 'skill not found or not executable' });
      return res.json({ status: 'ok', skill_id: skillId, result });
    } catch (err) {
      return res.status(500).json({ detail: String(err) });
    }
  });

  return router;
}
