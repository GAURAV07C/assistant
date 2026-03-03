import cors from 'cors';
import express, { type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSISTANT_NAME,
  GROQ_MODEL,
  GROQ_API_KEYS,
  MAX_MESSAGE_LENGTH,
  TAVILY_API_KEY,
} from './config.js';
import { MemoryService } from './core/memory/memoryService.js';
import { AuditService } from './core/safety/auditService.js';
import { SafetyService } from './core/safety/safetyService.js';
import { ChatRequestSchema, TTSRequestSchema } from './models/schemas.js';
import { createExtensionRouter } from './routes/extensionRoutes.js';
import { ChatService } from './services/chatService.js';
import { AllGroqApisFailedError, GroqService } from './services/groqService.js';
import { RealtimeGroqService } from './services/realtimeService.js';
import { TTSService, mergeShort, splitSentences } from './services/ttsService.js';
import { VectorStoreService } from './services/vectorStore.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

let vectorStoreService: VectorStoreService;
let groqService: GroqService;
let realtimeService: RealtimeGroqService;
let chatService: ChatService;
const memoryService = new MemoryService();
const auditService = new AuditService();
const safetyService = new SafetyService();
const ttsService = new TTSService();

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

app.get('/api', (_req, res) => {
  res.json({
    message: 'J.A.R.V.I.S API (TypeScript)',
    endpoints: {
      '/chat': 'General chat (non-streaming)',
      '/chat/stream': 'General chat (streaming with optional inline TTS)',
      '/chat/realtime': 'Realtime chat (non-streaming)',
      '/chat/realtime/stream': 'Realtime chat (streaming with optional inline TTS)',
      '/agent/plan': 'Create a structured plan for a task',
      '/agent/execute': 'Execute a planned task step using safe backend tools',
      '/mentor/code/explain': 'Explain selected code with context',
      '/mentor/code/refactor': 'Suggest refactor with rationale and patch',
      '/mentor/code/fix': 'Suggest bug fix with rationale and patch',
      '/memory/upsert': 'Upsert long-term structured memory',
      '/memory/profile': 'Read merged profile + long-term memory',
      '/audit/recent': 'Read recent audit logs',
      '/chat/history/:session_id': 'Get chat history',
      '/health': 'System health check',
      '/tts': 'Standalone text-to-speech (audio/mpeg)',
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
  });
});

app.post('/chat', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

  try {
    const { message, session_id } = parsed.data;
    if (message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ detail: 'Message too long' });

    const sid = chatService.getOrCreateSession(session_id);
    const out = await chatService.processMessageWithMeta(sid, message);
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
    const { message, session_id } = parsed.data;
    const sid = chatService.getOrCreateSession(session_id);
    const out = await chatService.processRealtimeMessageWithMeta(sid, message);
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
    const { message, session_id, tts } = parsed.data;
    const sid = chatService.getOrCreateSession(session_id);
    setupSse(res);
    const streamOut = chatService.processMessageStreamWithMeta(sid, message);
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
    const { message, session_id, tts } = parsed.data;
    const sid = chatService.getOrCreateSession(session_id);
    setupSse(res);
    const streamOut = chatService.processRealtimeMessageStreamWithMeta(sid, message);
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
}));

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
  console.log(`[CONFIG] Groq keys loaded: ${GROQ_API_KEYS.length}`);
  console.log(`[CONFIG] Tavily: ${TAVILY_API_KEY ? 'configured' : 'NOT SET'}`);

  vectorStoreService = new VectorStoreService();
  vectorStoreService.createVectorStore();

  groqService = new GroqService(vectorStoreService);
  realtimeService = new RealtimeGroqService(vectorStoreService);
  chatService = new ChatService(groqService, realtimeService);
  const port = Number(process.env.PORT || 8000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`TypeScript API: http://localhost:${port}`);
    console.log(`TypeScript Frontend: http://localhost:${port}/app/`);
  });

  const shutdown = () => {
    try {
      chatService.saveAllSessions();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
