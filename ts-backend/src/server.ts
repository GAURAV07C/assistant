import cors from 'cors';
import express, { type Response } from 'express';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import {
  ASSISTANT_NAME,
  GROQ_MODEL,
  OPENROUTER_MODEL,
  OPENROUTER_MODELS,
  OPENROUTER_API_KEY,
  OPENROUTER_API_KEYS,
  GEMINI_MODEL,
  GEMINI_API_KEY,
  GEMINI_API_KEYS,
  GROQ_API_KEYS,
  MAX_MESSAGE_LENGTH,
  MEMORY_DATA_DIR,
  TAVILY_API_KEY,
  TAVILY_API_KEYS,
} from './config.js';
import { MemoryService } from './core/memory/memoryService.js';
import { PersonalAssistantService } from './core/memory/personalAssistantService.js';
import { AgentController } from './core/agent/controller.js';
import { VoiceService } from './core/voice/voiceService.js';
import { AuditService } from './core/safety/auditService.js';
import { SafetyService } from './core/safety/safetyService.js';
import { RouterLogs } from './core/safety/router_logs.js';
import { ChatRequestSchema, TTSRequestSchema } from './models/schemas.js';
import { createExtensionRouter } from './routes/extensionRoutes.js';
import { createLearningRouter } from './routes/learningRoutes.js';
import { ChatService } from './services/chatService.js';
import { AllGroqApisFailedError, GroqService } from './services/groqService.js';
import { RealtimeGroqService } from './services/realtimeService.js';
import { TTSService, mergeShort, splitSentences } from './services/ttsService.js';
import { VectorStoreService } from './services/vectorStore.js';
import { getRuntimeProviderKeys, maskedKeys, setRuntimeProviderKeys, type RuntimeProvider } from './services/runtimeKeyStore.js';
import { LearningScheduler } from './learning/learning_scheduler.js';
import { EmbeddingEngine } from './learning/embedding_engine.js';
import { ResearchEngine } from './research/research_engine.js';
import { ReasoningEngine } from './reasoning/reasoning_engine.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;
    console.log(`[REQUEST] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(2)}ms)`);
  });
  next();
});

let vectorStoreService: VectorStoreService;
let groqService: GroqService;
let realtimeService: RealtimeGroqService;
let chatService: ChatService;
let agentController!: AgentController;
let learningScheduler: LearningScheduler;
let runtimeGroqKeys: string[] = [];
let runtimeOpenRouterKeys: string[] = [];
let runtimeOpenRouterModels: string[] = [];
let runtimeGeminiKeys: string[] = [];
let runtimeTavilyKeys: string[] = [];
let researchEngine: ResearchEngine;
const routerLogs = new RouterLogs();
const memoryService = new MemoryService();
const personalAssistantService = new PersonalAssistantService();
const auditService = new AuditService();
const safetyService = new SafetyService();
const voiceService = new VoiceService();
const ttsService = new TTSService(voiceService);
const ACTIVE_SESSION_FILE = path.join(MEMORY_DATA_DIR, 'active_session.json');

function readActiveSessionId(): string | null {
  if (!fs.existsSync(ACTIVE_SESSION_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(ACTIVE_SESSION_FILE, 'utf8')) as { session_id?: string };
    const sid = String(parsed.session_id || '').trim();
    return sid || null;
  } catch {
    return null;
  }
}

function writeActiveSessionId(sessionId: string): void {
  fs.writeFileSync(ACTIVE_SESSION_FILE, JSON.stringify({ session_id: sessionId, updated_at: new Date().toISOString() }, null, 2), 'utf8');
}

function resolveSessionId(incoming: string | null | undefined, sharedSession = true): string {
  if (incoming && String(incoming).trim()) {
    const sid = chatService.getOrCreateSession(incoming);
    writeActiveSessionId(sid);
    return sid;
  }

  if (sharedSession) {
    const active = readActiveSessionId();
    if (active) {
      const sid = chatService.getOrCreateSession(active);
      writeActiveSessionId(sid);
      return sid;
    }
  }

  const sid = chatService.getOrCreateSession(undefined);
  writeActiveSessionId(sid);
  return sid;
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('tokens per day');
}

function sseWrite(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

type StreamItem = string | { _search_results: unknown };

type TrackedAudio = {
  sentence: string;
  done: boolean;
  value?: string;
  error?: unknown;
  promise: Promise<void>;
};

function submitAudio(queue: TrackedAudio[], sentence: string): void {
  const tracked: TrackedAudio = {
    sentence,
    done: false,
    promise: Promise.resolve(),
  };

  tracked.promise = ttsService
    .synthesizeBase64(sentence)
    .then((audioB64) => {
      tracked.value = audioB64;
      tracked.done = true;
    })
    .catch((err) => {
      tracked.error = err;
      tracked.done = true;
    });

  queue.push(tracked);
}

function drainReadyAudio(res: Response, queue: TrackedAudio[]): void {
  while (queue.length > 0 && queue[0].done) {
    const item = queue.shift()!;
    if (item.value) {
      sseWrite(res, { audio: item.value, sentence: item.sentence });
    }
  }
}

async function flushAudioQueue(res: Response, queue: TrackedAudio[]): Promise<void> {
  while (queue.length > 0) {
    const item = queue.shift()!;
    await item.promise;
    if (item.value) {
      sseWrite(res, { audio: item.value, sentence: item.sentence });
    }
  }
}

async function streamGenerator(
  res: Response,
  sessionId: string,
  iter: AsyncGenerator<StreamItem>,
  ttsEnabled: boolean,
  meta?: { sources: string[]; confidence: number },
): Promise<void> {
  sseWrite(res, { session_id: sessionId, chunk: '', done: false });
  if (meta) sseWrite(res, { citations: meta.sources, confidence: meta.confidence });

  let buffer = '';
  let held: string | null = null;
  let isFirst = true;
  const audioQueue: TrackedAudio[] = [];

  try {
    for await (const item of iter) {
      if (typeof item === 'object') {
        sseWrite(res, { search_results: item._search_results });
        continue;
      }

      if (!item) continue;

      sseWrite(res, { chunk: item, done: false });

      if (!ttsEnabled) continue;

      drainReadyAudio(res, audioQueue);

      buffer += item;
      const split = splitSentences(buffer);
      buffer = split.remaining;
      let sentences = mergeShort(split.sentences);

      if (held && sentences.length > 0 && sentences[0].trim().split(/\s+/).length <= 2) {
        held = `${held} ${sentences[0]}`.trim();
        sentences = sentences.slice(1);
      }

      sentences.forEach((sentence, idx) => {
        const minWords = isFirst ? 2 : 3;
        if (sentence.trim().split(/\s+/).length < minWords) return;

        const isLast = idx === sentences.length - 1;

        if (held) {
          submitAudio(audioQueue, held);
          held = null;
          isFirst = false;
        }

        if (isLast) {
          held = sentence;
        } else {
          submitAudio(audioQueue, sentence);
          isFirst = false;
        }
      });

      drainReadyAudio(res, audioQueue);
    }

    if (ttsEnabled) {
      const remaining = buffer.trim();

      if (held) {
        if (remaining && remaining.split(/\s+/).length <= 2) {
          submitAudio(audioQueue, `${held} ${remaining}`.trim());
        } else {
          submitAudio(audioQueue, held);
          if (remaining) submitAudio(audioQueue, remaining);
        }
      } else if (remaining) {
        submitAudio(audioQueue, remaining);
      }

      await flushAudioQueue(res, audioQueue);
    }

    sseWrite(res, { chunk: '', done: true, session_id: sessionId });
  } catch (err) {
    sseWrite(res, { chunk: '', done: true, error: String(err) });
  } finally {
    res.end();
  }
}


function adaptForAgent(message: string) {
  const contract = agentController.buildInternalContract(message);
  if (agentController.needsClarification(contract)) {
    return {
      clarification: true as const,
      contract,
      message: agentController.clarificationQuestion(contract),
    };
  }

  return {
    clarification: false as const,
    contract,
    message: agentController.mapMessageForMode(message, contract.selected_mode, contract.intent),
  };
}

function applyPersonalStyle(message: string, opts?: { coding?: boolean }): string {
  const profile = memoryService.profile();
  const style = (profile.structured_memory?.coding_style || {}) as Record<string, unknown>;
  const profileMemory = (profile.profile_memory || {}) as Record<string, unknown>;
  const hints: string[] = [];

  if (profileMemory && typeof profileMemory === 'object') {
    const value = (profileMemory.value || profileMemory) as Record<string, unknown>;
    if (typeof value.response_style === 'string') hints.push(`Preferred response style: ${value.response_style}`);
    if (typeof value.depth === 'string') hints.push(`Preferred depth: ${value.depth}`);
    if (typeof value.tone === 'string') hints.push(`Preferred tone: ${value.tone}`);
  }

  if (opts?.coding) {
    if (typeof style.indentation === 'string') hints.push(`Coding indentation: ${style.indentation}`);
    if (typeof style.naming_style === 'string') hints.push(`Coding naming style: ${style.naming_style}`);
    if (typeof style.semicolon_usage === 'string') hints.push(`Semicolon style: ${style.semicolon_usage}`);
  }

  if (hints.length === 0) return message;
  return [
    'Personalization hints (apply naturally, do not mention them):',
    ...hints.map((h) => `- ${h}`),
    '',
    `User request: ${message}`,
  ].join('\n');
}

type WsMessage = {
  type?: string;
  request_id?: string;
  prompt?: string;
  action?: 'start' | 'stop' | 'restart' | 'clear_memory' | 'refresh_knowledge';
  topics?: string[];
  keys?: string[];
  models?: string[];
  provider?: RuntimeProvider;
};

function wsSend(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function statusToAgentProgress(status: ReturnType<AgentController['getEvolutionStatus']>) {
  return (status.agents || []).map((name) => ({
    id: String(name || '').toLowerCase().replace(/\s+/g, '_'),
    name,
    status: 'idle',
    progress: 0,
    executionTimeMs: 0,
  }));
}

function setupAiosWebSocket(server: ReturnType<typeof createServer>): void {
  const wss = new WebSocketServer({ server, path: '/ws/ai-os-v3' });

  const systemMetrics = (status?: ReturnType<AgentController['getEvolutionStatus']>) => {
    const load = os.loadavg()[0] || 0;
    const cpu = Math.max(0, Math.min(100, Math.round((load / Math.max(1, os.cpus().length)) * 100)));
    const memUsed = process.memoryUsage().rss;
    const memTotal = os.totalmem() || 1;
    const memory = Math.max(0, Math.min(100, Math.round((memUsed / memTotal) * 100)));
    const activeTasks = Number(status?.task_memory?.success?.total || 0);
    const health = cpu > 88 || memory > 88 ? 'degraded' : 'healthy';
    return { cpu, memory, activeTasks, health };
  };

  const syncState = (ws: WebSocket) => {
    const status = agentController.getEvolutionStatus();
    wsSend(ws, { type: 'snapshot', data: status });
    wsSend(ws, { type: 'skills', data: agentController.listSkills() });
    wsSend(ws, { type: 'memory_profile', data: memoryService.profile() });
    wsSend(ws, { type: 'audit_logs', data: auditService.recent(50) });
    wsSend(ws, {
      type: 'health',
      data: {
        status: 'healthy',
        vector_store: !!vectorStoreService,
        groq_service: !!groqService,
        realtime_service: !!realtimeService,
        chat_service: !!chatService,
        learning_scheduler: !!learningScheduler,
      },
    });
    wsSend(ws, { type: 'agent_update', agents: statusToAgentProgress(status) });
    wsSend(ws, { type: 'system_metrics', metrics: systemMetrics(status) });
    const pushProvider = (provider: RuntimeProvider, keys: string[]) => {
      wsSend(ws, {
        type: 'api_keys',
        provider,
        count: keys.length,
        masked: maskedKeys(keys),
      });
    };
    pushProvider('groq', runtimeGroqKeys);
    pushProvider('openrouter', runtimeOpenRouterKeys);
    pushProvider('gemini', runtimeGeminiKeys);
    pushProvider('tavily', runtimeTavilyKeys);
    wsSend(ws, {
      type: 'provider_models',
      provider: 'openrouter',
      models: runtimeOpenRouterModels,
      count: runtimeOpenRouterModels.length,
    });
  };

  wss.on('connection', (ws: WebSocket) => {
    wsSend(ws, { type: 'log', level: 'info', message: 'AI_OS_V3 websocket connected' });
    syncState(ws);
    const metricsTimer = setInterval(() => {
      const status = agentController.getEvolutionStatus();
      wsSend(ws, { type: 'system_metrics', metrics: systemMetrics(status) });
    }, 3000);

    ws.on('message', async (raw: RawData) => {
      let msg: WsMessage = {};
      try {
        msg = JSON.parse(String(raw || '{}')) as WsMessage;
      } catch {
        wsSend(ws, { type: 'log', level: 'warn', message: 'Invalid WS JSON payload' });
        return;
      }

      if (msg.type === 'state_sync_request') {
        syncState(ws);
        return;
      }

      if (msg.type === 'api_keys_request') {
        const provider = (msg.provider || 'groq') as RuntimeProvider;
        const map: Record<RuntimeProvider, string[]> = {
          groq: runtimeGroqKeys,
          openrouter: runtimeOpenRouterKeys,
          gemini: runtimeGeminiKeys,
          tavily: runtimeTavilyKeys,
        };
        wsSend(ws, {
          type: 'api_keys',
          provider,
          count: map[provider].length,
          masked: maskedKeys(map[provider]),
        });
        return;
      }

      if (msg.type === 'api_keys_update') {
        const provider = (msg.provider || 'groq') as RuntimeProvider;
        const nextKeys = Array.isArray(msg.keys) ? msg.keys.map((k) => String(k || '').trim()).filter(Boolean) : [];
        if (nextKeys.length === 0) {
          wsSend(ws, { type: 'api_keys_error', error: 'At least one API key is required' });
          return;
        }

        try {
          const patch: Record<string, string[]> = {};
          if (provider === 'groq') patch.groq_api_keys = nextKeys;
          if (provider === 'openrouter') patch.openrouter_api_keys = nextKeys;
          if (provider === 'gemini') patch.gemini_api_keys = nextKeys;
          if (provider === 'tavily') patch.tavily_api_keys = nextKeys;
          const stored = setRuntimeProviderKeys(patch);
          runtimeGroqKeys = stored.groq_api_keys;
          runtimeOpenRouterKeys = stored.openrouter_api_keys;
          runtimeOpenRouterModels = stored.openrouter_models;
          runtimeGeminiKeys = stored.gemini_api_keys;
          runtimeTavilyKeys = stored.tavily_api_keys;

          const countA = groqService.updateApiKeys(runtimeGroqKeys);
          const countB = realtimeService.updateApiKeys(runtimeGroqKeys);
          GroqService.updateExternalApiKeys({
            openrouter_api_keys: runtimeOpenRouterKeys,
            openrouter_models: runtimeOpenRouterModels,
            gemini_api_keys: runtimeGeminiKeys,
          });
          const tavilyRealtime = realtimeService.updateTavilyKeys(runtimeTavilyKeys);
          const tavilyResearch = researchEngine.updateTavilyKeys(runtimeTavilyKeys);
          wsSend(ws, {
            type: 'api_keys_updated',
            provider,
            count: nextKeys.length,
            masked: maskedKeys(nextKeys),
          });
          wsSend(ws, {
            type: 'log',
            level: 'info',
            message: `Runtime keys updated (${provider}) groq=${countA}/${countB} tavily=${tavilyRealtime}/${tavilyResearch}`,
          });
          syncState(ws);
        } catch (err) {
          wsSend(ws, { type: 'api_keys_error', error: String(err) });
        }
        return;
      }

      if (msg.type === 'provider_models_request') {
        const provider = (msg.provider || '') as RuntimeProvider;
        if (provider !== 'openrouter') {
          wsSend(ws, { type: 'provider_models_error', error: 'Only openrouter models are currently configurable' });
          return;
        }
        wsSend(ws, {
          type: 'provider_models',
          provider: 'openrouter',
          models: runtimeOpenRouterModels,
          count: runtimeOpenRouterModels.length,
        });
        return;
      }

      if (msg.type === 'provider_models_update') {
        const provider = (msg.provider || '') as RuntimeProvider;
        if (provider !== 'openrouter') {
          wsSend(ws, { type: 'provider_models_error', error: 'Only openrouter models are currently configurable' });
          return;
        }
        const nextModels = Array.isArray(msg.models) ? msg.models.map((m) => String(m || '').trim()).filter(Boolean) : [];
        if (nextModels.length === 0) {
          wsSend(ws, { type: 'provider_models_error', error: 'At least one model is required' });
          return;
        }
        try {
          const stored = setRuntimeProviderKeys({ openrouter_models: nextModels });
          runtimeOpenRouterModels = stored.openrouter_models;
          GroqService.updateExternalApiKeys({
            openrouter_api_keys: runtimeOpenRouterKeys,
            openrouter_models: runtimeOpenRouterModels,
            gemini_api_keys: runtimeGeminiKeys,
          });
          wsSend(ws, {
            type: 'provider_models_updated',
            provider: 'openrouter',
            models: runtimeOpenRouterModels,
            count: runtimeOpenRouterModels.length,
          });
          wsSend(ws, {
            type: 'log',
            level: 'info',
            message: `OpenRouter model list updated (${runtimeOpenRouterModels.length} models)`,
          });
          syncState(ws);
        } catch (err) {
          wsSend(ws, { type: 'provider_models_error', error: String(err) });
        }
        return;
      }

      if (msg.type === 'system_action') {
        if (msg.action === 'clear_memory') {
          const cleaned = memoryService.cleanupStaleMemory({ min_age_days: 0, max_delete: 250, confidence_threshold: 40 });
          wsSend(ws, { type: 'log', level: 'info', message: `Memory cleanup done: ${cleaned.deleted}` });
        } else if (msg.action === 'refresh_knowledge') {
          const out = await agentController.runAutonomousMaintenance();
          wsSend(ws, { type: 'log', level: 'info', message: `Knowledge refresh done: meta_score=${out.meta_score}` });
        } else if (msg.action === 'restart') {
          wsSend(ws, { type: 'log', level: 'warn', message: 'Restart requested (manual infra action required)' });
        } else if (msg.action === 'start' || msg.action === 'stop') {
          wsSend(ws, { type: 'log', level: 'info', message: `Agent action accepted: ${msg.action}` });
        }
        syncState(ws);
        return;
      }

      if (msg.type === 'chat_prompt') {
        const requestId = String(msg.request_id || `req_${Date.now()}`);
        const prompt = String(msg.prompt || '').trim();
        if (!prompt) {
          wsSend(ws, { type: 'chat_error', request_id: requestId, error: 'prompt is required' });
          return;
        }

        const sid = resolveSessionId(undefined, true);
        const contract = agentController.buildInternalContract(prompt);
        const steps = contract.plan.steps.slice(0, 8);
        const activeId = String(contract.intent || 'agent');
        wsSend(ws, {
          type: 'agent_update',
          agents: [{
            id: activeId,
            name: activeId,
            status: 'running',
            progress: 5,
            executionTimeMs: 0,
          }],
        });
        wsSend(ws, { type: 'active_agent', agent: contract.intent });
        for (const step of steps) wsSend(ws, { type: 'reasoning_step', step });

        try {
          const streamOut = chatService.processMessageStreamWithMeta(sid, applyPersonalStyle(agentController.mapMessageForMode(prompt, contract.selected_mode, contract.intent)));
          let full = '';
          const started = Date.now();
          let chunks = 0;
          for await (const item of streamOut.stream) {
            if (typeof item !== 'string' || !item) continue;
            full += item;
            chunks += 1;
            wsSend(ws, { type: 'stream_chunk', request_id: requestId, chunk: item });
            wsSend(ws, {
              type: 'agent_update',
              agents: [{
                id: activeId,
                name: activeId,
                status: 'running',
                progress: Math.min(95, 5 + chunks),
                executionTimeMs: Date.now() - started,
              }],
            });
          }
          chatService.saveChatSession(sid);
          wsSend(ws, {
            type: 'chat_final',
            request_id: requestId,
            response: full,
            steps,
            agent: contract.intent,
            session_id: sid,
          });
          wsSend(ws, {
            type: 'agent_update',
            agents: [{
              id: activeId,
              name: activeId,
              status: 'completed',
              progress: 100,
              executionTimeMs: Date.now() - started,
            }],
          });
          wsSend(ws, { type: 'log', level: 'info', message: `Chat completed: ${requestId}` });
          syncState(ws);
        } catch (err) {
          wsSend(ws, {
            type: 'agent_update',
            agents: [{
              id: activeId,
              name: activeId,
              status: 'idle',
              progress: 0,
              executionTimeMs: 0,
            }],
          });
          wsSend(ws, { type: 'chat_error', request_id: requestId, error: String(err) });
        }
      }
    });
    ws.on('close', () => {
      clearInterval(metricsTimer);
    });
  });
}

app.get('/api', (_req, res) => {
  res.json({
    message: 'J.A.R.V.I.S API (TypeScript)',
    endpoints: {
      '/chat': 'General chat (non-streaming)',
      '/chat/stream': 'General chat (streaming with optional inline TTS)',
      '/chat/realtime': 'Realtime chat (non-streaming)',
      '/chat/realtime/stream': 'Realtime chat (streaming with optional inline TTS)',
      '/extension/chat/stream': 'VS Code extension coding-only chat stream',
      '/extension/chat/realtime/stream': 'VS Code extension coding-only realtime stream',
      '/agent/plan': 'Create a structured plan for a task',
      '/agent/execute': 'Execute a planned task step using safe backend tools',
      '/mentor/code/explain': 'Explain selected code with context',
      '/mentor/code/refactor': 'Suggest refactor with rationale and patch',
      '/mentor/code/fix': 'Suggest bug fix with rationale and patch',
      '/memory/upsert': 'Upsert long-term structured memory',
      '/memory/profile': 'Read merged profile + long-term memory',
      '/learning/file': 'Read or write learning_data text files from UI',
      '/workspace/files': 'List editable workspace files for React dashboard editor',
      '/workspace/file': 'Read/write editable workspace file content',
      '/voice/settings': 'Get or update active voice config',
      '/voice/custom': 'Create or update custom voice profile (+ optional sample upload)',
      '/audit/recent': 'Read recent audit logs',
      '/evolution/status': 'Developer evolution engine status (skills, curriculum, graph, metrics, agents)',
      '/reflection/recent': 'Read recent self-reflection reviews',
      '/curriculum/next': 'Get next curriculum task and learning resources',
      '/router/stats': 'Read dual-brain routing summary',
      '/assistant/digest/daily': 'Get personal daily digest (auto-generated)',
      '/assistant/reminders': 'Create/list personal reminders',
      '/assistant/reminders/:id/done': 'Mark reminder as done',
      '/memory/confidence': 'Read memory confidence and stale indicators',
      '/memory/recall-debug': 'Preview which memories would be injected for a query',
      '/memory/cleanup': 'Cleanup stale low-confidence memory records',
      '/skills/list': 'List all skills with level/intelligence status',
      '/skills/detail/:skill_id': 'Read profile + memory for one skill',
      '/skills/toggle': 'Enable or disable a skill',
      '/skills/learn': 'Trigger skill learning from a task/conversation',
      '/skills/evolve': 'Evolve skill score based on result feedback',
      '/skills/execute': 'Execute skill workflow preview',
      '/chat/history/:session_id': 'Get chat history',
      '/health': 'System health check',
      '/session/active': 'Get or set shared active chat session',
      '/tts': 'Standalone text-to-speech (audio/mpeg)',
      '/ws/ai-os-v3': 'Realtime websocket stream for AI_OS_V3 dashboard',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    vector_store: !!vectorStoreService,
    groq_service: !!groqService,
    realtime_service: !!realtimeService,
    chat_service: !!chatService,
    learning_scheduler: !!learningScheduler,
  });
});

app.get('/router/stats', (_req, res) => {
  try {
    const summary = routerLogs.summary(500);
    const recent = routerLogs.recent(20);
    return res.json({ status: 'ok', summary, recent });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.get('/session/active', (_req, res) => {
  return res.json({ session_id: readActiveSessionId() });
});

app.get('/assistant/reminders', (req, res) => {
  try {
    const includeDone = String(req.query.include_done || '').toLowerCase() === 'true';
    const dueBefore = req.query.due_before ? String(req.query.due_before) : undefined;
    const dueAfter = req.query.due_after ? String(req.query.due_after) : undefined;
    const reminders = personalAssistantService.listReminders({
      include_done: includeDone,
      due_before: dueBefore,
      due_after: dueAfter,
    });
    return res.json({ status: 'ok', count: reminders.length, reminders });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.post('/assistant/reminders', (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ detail: 'title is required' });
    const reminder = personalAssistantService.addReminder({
      title,
      due_at: req.body?.due_at,
      notes: req.body?.notes,
      tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
    });
    auditService.log({
      ts: new Date().toISOString(),
      route: '/assistant/reminders',
      action: 'reminder_create',
      status: 'allowed',
      details: { id: reminder.id, due_at: reminder.due_at },
    });
    return res.json({ status: 'ok', reminder });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.put('/assistant/reminders/:id/done', (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ detail: 'id is required' });
    const reminder = personalAssistantService.markReminderDone(id);
    if (!reminder) return res.status(404).json({ detail: 'reminder not found' });
    return res.json({ status: 'ok', reminder });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.get('/assistant/digest/daily', (_req, res) => {
  try {
    const conf = memoryService.memoryConfidence(500);
    const evolution = agentController.getEvolutionStatus();
    const reminders = personalAssistantService.listReminders({ include_done: false });
    const digest = personalAssistantService.generateDailyDigest({
      memory_records: conf.total,
      avg_memory_confidence: conf.avg_confidence,
      pending_reminders: reminders.length,
      top_skills: (evolution.skill_evolution?.top_skills || []).map((s: any) => String(s?.name || s?.id || '')).filter(Boolean),
      recent_audits: auditService.recent(20).length,
    });
    return res.json({ status: 'ok', digest });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.get('/memory/confidence', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 200)));
    const out = memoryService.memoryConfidence(limit);
    return res.json({ status: 'ok', ...out });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.post('/memory/recall-debug', (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ detail: 'message is required' });
    const recall = memoryService.buildRecallContext(message, 12);
    const preview = memoryService.previewPersonalFacts(message);
    return res.json({
      status: 'ok',
      query: message,
      injected_memory_facts: recall.facts,
      memory_sources: recall.sources,
      extracted_personal_facts_preview: preview,
      total_injected: recall.facts.length,
    });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.post('/memory/cleanup', (req, res) => {
  try {
    const result = memoryService.cleanupStaleMemory({
      min_age_days: req.body?.min_age_days,
      max_delete: req.body?.max_delete,
      confidence_threshold: req.body?.confidence_threshold,
    });
    auditService.log({
      ts: new Date().toISOString(),
      route: '/memory/cleanup',
      action: 'memory_cleanup',
      status: 'allowed',
      details: result,
    });
    return res.json({ status: 'ok', ...result });
  } catch (err) {
    return res.status(500).json({ detail: String(err) });
  }
});

app.put('/session/active', (req, res) => {
  const sid = String(req.body?.session_id || '').trim();
  if (!sid) return res.status(400).json({ detail: 'session_id is required' });
  try {
    const resolved = chatService.getOrCreateSession(sid);
    writeActiveSessionId(resolved);
    return res.json({ status: 'ok', session_id: resolved });
  } catch (err) {
    return res.status(400).json({ detail: String(err) });
  }
});

app.post('/chat', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id, shared_session } = parsed.data;
    if (message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ detail: 'Message too long' });

    const sid = resolveSessionId(session_id, shared_session);
    const agent = adaptForAgent(message);
    if (agent.clarification) {
      return res.json({
        response: agent.message,
        session_id: sid,
        citations: [],
        confidence: 35,
        internal_contract: {
          intent: agent.contract.intent,
          complexity_score: agent.contract.complexity_score,
          selected_mode: agent.contract.selected_mode,
          ambiguity_score: agent.contract.ambiguity_score,
        },
      });
    }

    const out = await chatService.processMessageWithMeta(sid, applyPersonalStyle(agent.message));
    chatService.saveChatSession(sid);
    auditService.log({
      ts: new Date().toISOString(),
      route: '/chat',
      action: 'chat',
      status: 'allowed',
      session_id: sid,
      details: { confidence: out.confidence, citations: out.sources.slice(0, 5) },
    });
    return res.json({
      response: out.response,
      session_id: sid,
      citations: out.sources,
      confidence: out.confidence,
    });
  } catch (err) {
    if (err instanceof AllGroqApisFailedError) return res.status(503).json({ detail: err.message });
    if (isRateLimitError(err)) return res.status(429).json({ detail: 'Daily rate limit reached. Try again later.' });
    return res.status(500).json({ detail: String(err) });
  }
});

app.post('/chat/realtime', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id, shared_session } = parsed.data;
    const sid = resolveSessionId(session_id, shared_session);
    const agent = adaptForAgent(message);
    if (agent.clarification) {
      return res.json({
        response: agent.message,
        session_id: sid,
        citations: [],
        confidence: 35,
        internal_contract: {
          intent: agent.contract.intent,
          complexity_score: agent.contract.complexity_score,
          selected_mode: agent.contract.selected_mode,
          ambiguity_score: agent.contract.ambiguity_score,
        },
      });
    }

    const out = await chatService.processRealtimeMessageWithMeta(sid, applyPersonalStyle(agent.message));
    chatService.saveChatSession(sid);
    auditService.log({
      ts: new Date().toISOString(),
      route: '/chat/realtime',
      action: 'chat_realtime',
      status: 'allowed',
      session_id: sid,
      details: { confidence: out.confidence, citations: out.sources.slice(0, 5) },
    });
    return res.json({
      response: out.response,
      session_id: sid,
      citations: out.sources,
      confidence: out.confidence,
    });
  } catch (err) {
    if (err instanceof AllGroqApisFailedError) return res.status(503).json({ detail: err.message });
    if (isRateLimitError(err)) return res.status(429).json({ detail: 'Daily rate limit reached. Try again later.' });
    return res.status(500).json({ detail: String(err) });
  }
});

app.post('/chat/stream', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id, tts, shared_session } = parsed.data;
    const sid = resolveSessionId(session_id, shared_session);
    const agent = adaptForAgent(message);
    setupSse(res);
    if (agent.clarification) {
      async function* clarifyStream(): AsyncGenerator<string> {
        yield agent.message;
      }
      await streamGenerator(res, sid, clarifyStream(), !!tts, { sources: [], confidence: 35 });
      return;
    }
    const streamOut = chatService.processMessageStreamWithMeta(sid, applyPersonalStyle(agent.message));
    await streamGenerator(res, sid, streamOut.stream, !!tts, streamOut.meta);
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ detail: String(err) });
    res.end();
  }
});

app.post('/chat/realtime/stream', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id, tts, shared_session } = parsed.data;
    const sid = resolveSessionId(session_id, shared_session);
    const agent = adaptForAgent(message);
    setupSse(res);
    if (agent.clarification) {
      async function* clarifyStream(): AsyncGenerator<string> {
        yield agent.message;
      }
      await streamGenerator(res, sid, clarifyStream(), !!tts, { sources: [], confidence: 35 });
      return;
    }
    const streamOut = chatService.processRealtimeMessageStreamWithMeta(sid, applyPersonalStyle(agent.message));
    await streamGenerator(res, sid, streamOut.stream, !!tts, streamOut.meta);
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ detail: String(err) });
    res.end();
  }
});



app.post('/extension/chat/stream', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id, tts, shared_session } = parsed.data;
    const sid = resolveSessionId(session_id, shared_session);
    setupSse(res);
    const streamOut = chatService.processExtensionCodeMessageStreamWithMeta(sid, applyPersonalStyle(message, { coding: true }));
    await streamGenerator(res, sid, streamOut.stream, !!tts, streamOut.meta);
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ detail: String(err) });
    res.end();
  }
});

app.post('/extension/chat/realtime/stream', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id, tts, shared_session } = parsed.data;
    const sid = resolveSessionId(session_id, shared_session);
    setupSse(res);
    const streamOut = chatService.processExtensionCodeRealtimeMessageStreamWithMeta(sid, applyPersonalStyle(message, { coding: true }));
    await streamGenerator(res, sid, streamOut.stream, !!tts, streamOut.meta);
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ detail: String(err) });
    res.end();
  }
});
app.use(createExtensionRouter({
  getChatService: () => chatService,
  memoryService,
  auditService,
  safetyService,
  voiceService,
  agentController,
}));

app.use(createLearningRouter());

app.get('/chat/history/:session_id', (req, res) => {
  const sessionId = req.params.session_id;
  const messages = chatService.getChatHistory(sessionId);
  res.json({ session_id: sessionId, messages });
});

app.post('/tts', async (req, res) => {
  const parsed = TTSRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const mp3 = await ttsService.synthesizeRaw(parsed.data.text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(mp3);
  } catch (err) {
    res.status(500).json({ detail: `TTS failed: ${String(err)}` });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(process.cwd(), '..', 'frontend');

if (fs.existsSync(frontendDir)) {
  app.use('/app', express.static(frontendDir));
  app.get('/app/*', (_req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

app.get('/', (_req, res) => {
  res.redirect('/app/');
});

function bootstrap(): void {
  console.log('='.repeat(60));
  console.log('J.A.R.V.I.S TypeScript Backend Starting');
  console.log('='.repeat(60));
  console.log(`[CONFIG] Assistant name: ${ASSISTANT_NAME}`);
  console.log(`[CONFIG] Groq model: ${GROQ_MODEL}`);
  const runtime = getRuntimeProviderKeys({
    groq_api_keys: GROQ_API_KEYS,
    openrouter_api_keys: OPENROUTER_API_KEYS,
    openrouter_models: OPENROUTER_MODELS,
    gemini_api_keys: GEMINI_API_KEYS,
    tavily_api_keys: TAVILY_API_KEYS,
  });
  runtimeGroqKeys = runtime.groq_api_keys;
  runtimeOpenRouterKeys = runtime.openrouter_api_keys;
  runtimeOpenRouterModels = runtime.openrouter_models;
  runtimeGeminiKeys = runtime.gemini_api_keys;
  runtimeTavilyKeys = runtime.tavily_api_keys;
  console.log(`[CONFIG] Groq keys loaded (.env): ${GROQ_API_KEYS.length}`);
  console.log(`[CONFIG] Groq keys active (runtime): ${runtimeGroqKeys.length}`);
  console.log(`[CONFIG] OpenRouter keys active (runtime): ${runtimeOpenRouterKeys.length}`);
  console.log(`[CONFIG] OpenRouter models active (runtime): ${runtimeOpenRouterModels.length}`);
  console.log(`[CONFIG] Gemini keys active (runtime): ${runtimeGeminiKeys.length}`);
  console.log(`[CONFIG] Tavily keys active (runtime): ${runtimeTavilyKeys.length}`);
  console.log(`[CONFIG] OpenRouter: ${OPENROUTER_API_KEY ? `configured (${OPENROUTER_MODEL})` : 'NOT SET'} models=${OPENROUTER_MODELS.length}`);
  console.log(`[CONFIG] Gemini: ${GEMINI_API_KEY ? `configured (${GEMINI_MODEL})` : 'NOT SET'}`);
  console.log(`[CONFIG] Tavily: ${TAVILY_API_KEY ? 'configured' : 'NOT SET'}`);

  vectorStoreService = new VectorStoreService();
  vectorStoreService.createVectorStore();

  groqService = new GroqService(vectorStoreService);
  realtimeService = new RealtimeGroqService(vectorStoreService);
  groqService.updateApiKeys(runtimeGroqKeys);
  realtimeService.updateApiKeys(runtimeGroqKeys);
  GroqService.updateExternalApiKeys({
    openrouter_api_keys: runtimeOpenRouterKeys,
    openrouter_models: runtimeOpenRouterModels,
    gemini_api_keys: runtimeGeminiKeys,
  });
  realtimeService.updateTavilyKeys(runtimeTavilyKeys);
  learningScheduler = new LearningScheduler();
  researchEngine = new ResearchEngine(runtimeTavilyKeys);
  const reasoningEngine = new ReasoningEngine(new EmbeddingEngine(), researchEngine);
  chatService = new ChatService(groqService, realtimeService, learningScheduler, reasoningEngine, memoryService);
  agentController = new AgentController(chatService, memoryService, safetyService, auditService);
  learningScheduler.start(3);
  setInterval(() => {
    try {
      const conf = memoryService.memoryConfidence(400);
      const evolution = agentController.getEvolutionStatus();
      const reminders = personalAssistantService.listReminders({ include_done: false });
      personalAssistantService.generateDailyDigest({
        memory_records: conf.total,
        avg_memory_confidence: conf.avg_confidence,
        pending_reminders: reminders.length,
        top_skills: (evolution.skill_evolution?.top_skills || []).map((s: any) => String(s?.name || s?.id || '')).filter(Boolean),
        recent_audits: auditService.recent(20).length,
      });
      memoryService.cleanupStaleMemory({ min_age_days: 45, max_delete: 120, confidence_threshold: 30 });
      void agentController.runAutonomousMaintenance();
    } catch {
      // keep scheduler resilient
    }
  }, 6 * 60 * 60 * 1000);
  const port = Number(process.env.PORT || 8000);
  const server = createServer(app);
  setupAiosWebSocket(server);
  server.listen(port, '0.0.0.0', () => {
    console.log(`TypeScript API: http://localhost:${port}`);
    console.log(`TypeScript Frontend: http://localhost:${port}/app/`);
    console.log(`AI_OS_V3 WS: ws://localhost:${port}/ws/ai-os-v3`);
  });

  const shutdown = () => {
    try {
      learningScheduler.stop();
      chatService.saveAllSessions();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
