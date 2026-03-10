# ASTRO / JARVIS Development Report

Date: 2026-03-06  
Project root: `/root/assistant`

## SECTION 1 — Current Architecture

### 1) Monorepo/Workspace Layout
- Root workspace is configured with npm workspaces in `/root/assistant/package.json`:
  - `ts-backend`
  - `react-assistant-ui`
  - `vscode-Astro-extension`
- Root scripts already support monorepo-style install/dev/build orchestration (`dev`, `build`, `typecheck`, `watch`).

### 2) Backend Services (TypeScript)
- Main server: `/root/assistant/ts-backend/src/server.ts`
- Core runtime wiring:
  - `VectorStoreService` for retrieval context (`/services/vectorStore.ts`)
  - `GroqService` and `RealtimeGroqService` for LLM responses (`/services/groqService.ts`, `/services/realtimeService.ts`)
  - `ChatService` as session + routing + stream orchestrator (`/services/chatService.ts`)
  - `LearningScheduler` for periodic learning cycles (`/learning/learning_scheduler.ts`)
  - `ReasoningEngine` for intent/planning/memory+research augmentation (`/reasoning/reasoning_engine.ts`)
  - `AgentController` for plan/execute mode (`/core/agent/controller.ts`)
  - Safety + audit + router decision logging (`/core/safety/*.ts`)
  - Voice runtime settings + TTS synthesis (`/core/voice/voiceService.ts`, `/services/ttsService.ts`)

### 3) UI Components (React Assistant)
- Main app: `/root/assistant/react-assistant-ui/src/App.jsx`
- Entry: `/root/assistant/react-assistant-ui/src/main.jsx`
- Styling: `/root/assistant/react-assistant-ui/src/styles.css`
- UI includes:
  - streaming chat (general/realtime),
  - agent plan/execute panel,
  - memory/audit views,
  - learning file editor,
  - voice settings/custom voice upload,
  - microphone/voice loop controls.

### 4) VS Code Extension Components
- Activation and dependency wiring: `/root/assistant/vscode-Astro-extension/src/extension.ts`
- Webview chat panel: `/panels/chatViewProvider.ts`
- Backend API client with queue/timeout/routing: `/services/backendClient.ts`
- Live monitor and diagnostics: `/providers/liveMonitor.ts`
- Intelligence modules:
  - persistent memory engine: `/intelligence/memoryEngine.ts`
  - intent routing: `/intelligence/intentRouter.ts`
  - anti-pattern tracker: `/intelligence/antiPatternTracker.ts`
  - adaptive behavior: `/intelligence/behaviorEngine.ts`
  - surprise questions: `/intelligence/surpriseEngine.ts`
  - voice alerts: `/intelligence/voiceEngine.ts`

### 5) Database/Storage Usage
- Shared DB root from config: `/root/assistant/database` (via `/ts-backend/src/config.ts`)
- Key directories/files:
  - chats: `database/chats_data/*.json`
  - memory: `database/memory_data/*`
  - learning docs: `database/learning_data/*.txt`
  - audit logs: `database/audit_logs/*.jsonl`
  - datasets: `database/dataset/*`
  - learning runtime artifacts: `database/learning_runtime/*`
  - training exports: `database/training_exports/*.json`
  - voice data: `database/voice_data/*`
  - profile/style/anti-pattern/domain files: dedicated dirs under `database/`

### 6) AI Integration
- LLM provider: Groq via LangChain (`@langchain/groq`) in `/services/groqService.ts`
- Realtime web-search enhancement: Tavily in `/services/realtimeService.ts` and `/research/research_engine.ts`
- Dual-brain + guardrails:
  - input filter `/guardrails/input_filter.ts`
  - policy engine `/guardrails/policy_engine.ts`
  - output filter `/guardrails/output_filter.ts`
  - router `/core/agent/brain_router.ts`

## SECTION 2 — Implemented Features

1. Monorepo root workspace scripts implemented and functional (`/package.json`).
2. General chat + realtime chat (normal and streaming) implemented (`/server.ts`, `/chatService.ts`).
3. Shared session resolution and persistence implemented (`active_session.json`, `/server.ts`).
4. Dual-brain guardrail routing implemented end-to-end (`/guardrails/*`, `/core/agent/brain_*.ts`).
5. Brain route decision logging implemented (`/core/safety/router_logs.ts`, `/router/stats`).
6. Agent plan and execute APIs implemented with safety checks (`/routes/extensionRoutes.ts`, `/core/agent/controller.ts`).
7. Coding mentor APIs implemented:
   - explain/refactor/fix
   - complete/analyze
   - snippet generation
   - git commit message generation
8. Memory upsert/profile APIs implemented (`/memory/upsert`, `/memory/profile`).
9. Learning file read/write APIs implemented (`/learning/file` GET/PUT).
10. Voice settings/custom voice APIs implemented (`/voice/settings`, `/voice/custom`).
11. Audit recent API implemented (`/audit/recent`).
12. Standalone TTS endpoint implemented (`/tts`) and stream-time inline TTS chunking implemented.
13. Learning system implemented:
   - conversation dataset storage
   - knowledge extraction
   - pseudo-embedding storage/retrieval
   - knowledge graph updates
   - behavior profile learning
   - micro dataset build/export JSON
   - periodic scheduler cycle + cursor
14. Autonomous research trigger implemented (topic frequency based) in `LearningScheduler`.
15. React assistant UI implemented with:
   - stream chat,
   - agent plan/execute,
   - memory and audit visualization,
   - learning file editor,
   - voice configuration and custom voice upload.
16. VS Code extension implemented with:
   - chat/plan/suggestions panels,
   - coding commands,
   - live monitor diagnostics,
   - flow protection debounce,
   - anti-pattern advisory,
   - adaptive mode,
   - optional webview TTS alerts.

## SECTION 3 — Partially Implemented Features

1. Deep reasoning pipeline is heuristic-driven, not full autonomous planner:
   - `IntentAnalyzer`, `TaskPlanner`, `ReasoningBrainRouter` are rule-based.
   - No durable multi-step execution memory/rollback orchestration.
2. Embedding system is lightweight token-hash vectorization:
   - semantic retrieval exists, but not production-grade embedding model/vector DB.
3. Knowledge graph is keyword-allowlist based:
   - relations are simplistic `related_to` adjacency.
4. Research intelligence depends on Tavily availability:
   - if `TAVILY_API_KEY` missing, research expansion silently no-ops.
5. Extension stability layer is partial:
   - has queue + minimal request gap + timeout fallback.
   - no explicit circuit-breaker/backpressure metrics.
6. Voice architecture is split:
   - backend supports Edge-TTS stream chunks,
   - extension voice alerts use browser speech synthesis in webview.
7. Agent tool execution is LLM-prompt wrappers:
   - tools largely call `chatService.processMessage(...)` with prompt templates,
   - no deterministic code transformation engine.
8. Placeholder commands remain explicitly marked future in extension:
   - `astro.multiFileFuture`
   - `astro.agentModeFuture` is informational wrapper.

## SECTION 4 — Missing Phase-1 Features

Phase-1 target in blueprint is mostly present, but these gaps remain before “hardened complete”:

1. Strong safety policy hardening:
   - current safety regexes are basic; no policy DSL, no role matrix, no per-tool scoped permissions.
2. Robust RAG confidence/citation discipline:
   - sources are returned, but strict citation UI contract and hallucination fallback policy is not consistently enforced across all mentor endpoints.
3. Deterministic code-edit execution for mentor tools:
   - refactor/fix return freeform text/patch suggestions, not guaranteed executable edits.
4. Automated testing coverage is missing:
   - no clear unit/integration/e2e coverage for backend routes, extension behavior, or UI flows.
5. Request-level operational controls on backend:
   - no centralized request queue/rate limiter for all backend LLM calls.
6. Multi-file safe orchestration:
   - explicitly pending in extension command payload (`multiFileFuture`).
7. Production-grade observability:
   - logs exist, but no metrics dashboard/latency/error budget instrumentation.

## SECTION 5 — API Endpoints

Source files:
- `/root/assistant/ts-backend/src/server.ts`
- `/root/assistant/ts-backend/src/routes/extensionRoutes.ts`

### Core Backend
- `GET /api` — endpoint discovery summary.
- `GET /health` — service health flags.
- `GET /router/stats` — dual-brain routing summary and recent entries.
- `GET /session/active` — read shared active session ID.
- `PUT /session/active` — set shared active session ID.
- `POST /chat` — non-stream general chat.
- `POST /chat/realtime` — non-stream realtime/web-enriched chat.
- `POST /chat/stream` — SSE stream general chat (+ optional inline TTS).
- `POST /chat/realtime/stream` — SSE stream realtime chat (+ optional inline TTS).
- `POST /extension/chat/stream` — SSE coding-focused extension stream.
- `POST /extension/chat/realtime/stream` — SSE coding-focused realtime stream.
- `GET /chat/history/:session_id` — retrieve stored session history.
- `POST /tts` — synthesize raw audio/mpeg from text.

### Agent + Mentor + Memory + Voice + Audit (Extension Router)
- `POST /agent/plan` — build plan/internal contract.
- `POST /agent/execute` — run agent flow with safety confirmation gates.
- `POST /mentor/code/explain` — explain selected code.
- `POST /mentor/code/refactor` — refactor advice + optional patch text.
- `POST /mentor/code/fix` — bug-fix advice + optional patch text.
- `POST /mentor/code/complete` — JSON completion suggestions.
- `POST /mentor/code/analyze` — mode-driven code analysis JSON.
- `POST /mentor/snippet/generate` — JSON snippet object.
- `POST /mentor/git/commit-message` — conventional commit JSON output.
- `POST /memory/upsert` — upsert structured memory record.
- `GET /memory/profile` — get merged profile memory view.
- `GET /learning/file` — read learning text file.
- `PUT /learning/file` — write learning text file.
- `GET /voice/settings` — fetch voice settings + profiles.
- `PUT /voice/settings` — update active voice source/config.
- `POST /voice/custom` — create/update custom voice profile.
- `GET /audit/recent` — fetch recent audit logs.

## SECTION 6 — Data Flow

### A) Extension Chat Flow
1. User types in Astro webview (`chatViewProvider.ts`).
2. Extension builds context (`helpers.ts`): active file, selection, recent edits, staged diff.
3. `BackendClient.sendRoutedMessage(...)` classifies intent via extension `IntentRouter`.
4. For high-confidence coding intents:
   - calls targeted mentor endpoints (`/mentor/code/*`, `/mentor/snippet/generate`, etc.).
5. Otherwise fallback:
   - streams via `/extension/chat/stream` or realtime variant.
6. Backend `ChatService` stores user/assistant messages in session.
7. `BrainRouter` applies input filter -> policy -> Brain A/B -> output filter.
8. Response streams back as SSE chunks; extension updates UI incrementally.
9. Extension memory/monitor systems update local developer profile and advisories.

### B) React UI Chat Flow
1. User sends message in `/react-assistant-ui/src/App.jsx`.
2. UI prefixes mode hint (`Switch to strategic/casual mode`).
3. UI calls `/chat/stream` or `/chat/realtime/stream`.
4. Backend resolves shared/new session and optionally adapts via `AgentController`.
5. `ChatService` invokes dual-brain route and returns chunks.
6. UI renders streaming text, optional search payload, optional TTS behavior.
7. Conversation is persisted to `database/chats_data` and learning dataset pipeline.

### C) Learning/Continuous Intelligence Flow
1. `ChatService.storeLearning(...)` writes conversation records via `LearningScheduler.storeConversation`.
2. Dataset manager appends JSONL into:
   - `dataset/daily_logs`
   - `dataset/conversation_history`
3. Scheduler cycle:
   - reads unprocessed logs by cursor,
   - extracts structured insights,
   - updates embedding file + knowledge graph + behavior profile,
   - builds micro-model datasets and export JSON files,
   - may trigger autonomous web expansion for repeated concepts.

## SECTION 7 — Problems / Risks

1. Duplicate intent/routing logic exists in multiple layers:
   - extension intent router, backend agent intent logic, backend reasoning router, backend brain router policy.
   - risk: inconsistent behavior and debugging complexity.
2. Security baseline is regex-heavy:
   - good start, but brittle against obfuscated prompt attacks and nuanced misuse cases.
3. RAG pipeline quality risk:
   - vector store uses term frequency + local text chunks, not semantic embeddings for primary response grounding.
4. Learning data quality risk:
   - extracted insights are heuristic; noise/false positives can pollute embeddings/graph/training exports.
5. Research dependency fragility:
   - Tavily key missing means research layers degrade silently.
6. Extension runtime dependency risk:
   - voice alerts depend on webview speech APIs; behavior can differ across VS Code environments.
7. Missing test harness:
   - major feature breadth without strong automated coverage increases regression risk.
8. API surface has grown significantly:
   - without versioning/contracts, future breaking changes will be hard to manage.
9. CORS is currently wide-open (`app.use(cors())`):
   - acceptable for local dev, risky for broader deployment.

## SECTION 8 — Recommended Improvements

1. Unify routing stack contracts.
   - Define one canonical intent schema and share it across extension + backend.
   - Keep backend authoritative for final policy/safety decisions.
2. Introduce backend-wide resilience middleware.
   - Request queue, rate limiter, timeout budget, retry policy, and circuit breaker.
3. Harden safety engine.
   - Add action-policy matrix by endpoint/tool.
   - Add stricter prompt-injection and exfiltration checks with structured policy results.
4. Upgrade retrieval quality.
   - Move primary retrieval to real embedding/vector backend or at least stronger embedding model integration.
   - Enforce citations in response format for analysis/research classes.
5. Improve mentor output determinism.
   - For refactor/fix endpoints, return structured patch objects with validation status.
6. Add automated testing layers.
   - Backend: route + agent + guardrail tests.
   - Extension: integration smoke tests for commands/live monitor.
   - UI: streaming and agent panel flows.
7. Add observability.
   - Standardized structured logs, latency/error metrics, per-endpoint success ratio.
8. Tighten deployment posture.
   - Restrict CORS by environment.
   - Add API auth for non-local deployment scenarios.
9. Complete pending Phase-1 hardening items before Phase-2 expansion.
   - especially multi-file safety orchestration, citation discipline, and reliability gates.

