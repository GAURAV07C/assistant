# ASTRO / JARVIS — Monorepo Status Overview
Date: 2026-03-10 (UTC)

Yeh file poore project ka ek fresh snapshot deti hai: backend, UI, extension, learning stack, aur aaj tak ki intelligence upgrades. Sirf `JARVIS_BUILD_BLUEPRINT.md` aur yeh details file abhi repo me payi jani chahiye.

---

## 1. Repo Structure
- `ts-backend/`: Primary TypeScript AI runtime. `src/` ke andar hi saari advanced systems (core brain, guardrails, agents, learning, research, skills, safety, observability, self-improvement, etc.) implemented hain.
- `react-assistant-ui/`: Next.js + Tailwind + shadcn/ui-based dashboard that runs on `npm run dev:ui`. Yeh AI Command Center control panel hai, real-time streams aur voice controls ke saath.
- `vscode-Astro-extension/`: Extension that connects VS Code to the backend via `/extension/*` endpoints, manages live monitor, commands, voice prompt, and local developer profile memory.
- `database/`: Shared persistent store for chats, learning datasets, memory, audit logs, skill data, vector memory, and upgrade artifacts. TS backend aur Python runtime (legacy) share kuch data under same directories.

---

## 2. `ts-backend` Intelligence Stack (Key directories inside `src/`)
1. **Core / Brain Loop (`core/agent`, `core/os`, `core/memory`)**
   - `AgentController` orchestrates Observe → Understand → Retrieve → Reason → Plan → Simulate → Execute → Reflect → Learn → Evolve per request.
   - Fast path for casual chats (single LLM call) and strategic path for research/agent tasks share a unified `finalizeExecution` that logs vector memory updates, trace info, and intelligence metrics.
2. **Guardrails & Safety (`guardrails/`, `core/safety/`)**
   - Input filtering, policy routing (normal/research/risky), and output sanitization ensure safety.
   - `SafetyService` audits destructive actions, `AuditService` keeps logs.
3. **Agent Orchestration (`agents/`, `planning/`)**
   - Multi-agent orchestrator decomposes requests, assigns Planning, Research, Coding, Debug, Learning, Automation, Evaluation agents.
   - `TaskPlanningEngine` + `StepExecutor` create step traces and tool recommendations.
4. **Skills & Learning (`skills/`, `learning/`, `training/`, `meta_intelligence/`)**
   - Skill registry, memory, learning detectors, and curriculum engine track coding/research/planning proficiencies and evolve intelligence.
   - Continuous Learning Engine extracts knowledge, updates embeddings, and feeds skill prompts plus micro-model datasets.
5. **Memory & Knowledge (`memory/`, `intelligence/`, `task_memory/`)**
   - Semantic search, vector store, retrieval engine plus task memory capture patterns, success rates, and reuse candidates.
   - Knowledge builder, intelligence graph, and awareness modules detect gaps and generate curiosity prompts.
6. **Research, Reflection & Evolution (`research/`, `self_improvement/`, `self_evolution/`, `youtube_learning/`, `web_learning/`, `multimodal_learning/`)**
   - Autonomous research scheduler, topic detector, and knowledge builder run optional web/doc research.
   - Self-reflection logs responses, performance analytics, mistake detection, and improvement planning.
   - Self-evolution pipeline proposes architecture/optimizer improvements without touching production code.
7. **Tools & Resource Controls (`tools/`, `resource_manager/`)**
   - Secure tool router enforces permissions per agent (`file_tools`, `git_tools`, `terminal_tools`, `web_tools`).
   - Resource manager monitors tasks, queue depth, scheduling, and health metrics.
8. **Observability & Reporting (`evaluation/`, `curriculum/`, `goals/`, `awareness/`)**
   - Response evaluator, performance metrics, meta intelligence score, goal tracker, long-term goal scheduler, and awareness state provide dashboards with system intelligence scores, agent activity, research topics, and logs.
   - Logging engine, metrics collector, and trace systems instrument every route.

### API Notes
- `/chat/*`, `/chat/realtime/*`, `/agent/plan`, `/agent/execute`, `/mentor/*`, `/memory/*`, `/skills/*`, `/learning/file`, `/learning/youtube`, `/learning/web`, `/learning/multimodal`, `/learning/github`, `/learning/stats`, `/learning/github/stats`, `/voice/*`, `/tts`, `/audit/recent`, `/evolution/status` all draw from the above modules.
- `/learning/youtube`, `/learning/web`, `/learning/multimodal`, `/learning/stats` enhance the learning stack and feed new knowledge artifacts into the same engine.
- Fast path ensures each casual request logs only one Groq/OpenRouter/Gemini call to avoid rate limits; complex tasks log multi-step agent + tool usage.

---

## 3. `react-assistant-ui` Control Panel
- Next.js App Router with modular components (tabs for Overview, Chat, Agents, Skills, Files, Voice, Logs).
- Dark futuristic theme with neon glows, framer-motion animations, shadcn/ui primitives + Tailwind custom variables.
- Real-time WebSocket integration for agent monitoring, logs, and reasoning steps; voice/TTS playback uses fallback for SSR-safe `Audio`.
- Chat tab handles streaming responses, `AI Thinking...` cues, reasoning steps, agent execution metadata, and toggle for `casual/strategic`.
- Updates panel shows system intelligence score, meta intelligence snapshot, autonomous research state, awareness gaps, vector memory usage, long-term goals, task memory analytics, evolution proposals, and skill progress bars.
- Workspace & learning files editors hit backend safe file APIs; voice tab manages API keys, toggles, and custom uploads.

---

## 4. `vscode-Astro-extension` Touchpoints
- Commands (`astro.refactorSelection`, `astro.explain`, etc.) call backend mentor endpoints; webviews show plan/execution transcripts.
- Live Monitor hooks into local typing, anti-pattern detection, surprise questions, voice alerts (via TTS in webview) and relies on `developerProfile.json` for skill/style memory.
- Fetches root-level JS/TS workspace files through `/workspace/file` safely.
- Supports voice + chat integration, agent evidence, and value-based tracking inside VS Code pane.

---

## 5. Data & Persistence
- `database/chats_data`: Session-level chat JSON + SSE transcripts.
- `database/memory_data`: Profile memory, active session, coding style traits, anti-pattern counts.
- `database/dataset/*`: Conversation logs, daily datasets, training exports (coding/reasoning/knowledge).
- `database/learning_runtime`: Embeddings, knowledge graphs, behavior profiles, awareness state, autonomous research logs.
- `database/skills_data` & `skills_runtime`: Skill-specific knowledge, examples, mistakes, evolution telemetry.
- `database/upgrade_data`: Agent activity, vector memory store, long-term goal tracker, self-improvement plans, evolution proposals.
- `database/learning_runtime/youtube_knowledge.json`, `web_knowledge.json`, `multimodal_knowledge.json`, `learning_stats.json`: Structured learning artifacts produced by the new agents.

Full stack uses shared storage so Python legacy runtime (if run concurrently) sees the same data.

---

## 6. Running & Interaction Notes
1. Install dependencies at root (`npm install`).
2. Run `npm run dev` from root to start backend (`http://localhost:8000`), UI (`http://localhost:5174`), and extension watchers concurrently.
3. Backend endpoints: use `/chat/stream` (SSE), `/agent/*`, `/voice/*`, `/skills/*`, `/learning/file` for automation.
4. Dashboard and VS Code extension both tap into same backend, so voice/chat commands, TTS streaming, log console, and agent controls stay synchronized.
5. Fast/medium/deep execution decision ensures casual user talk stays quick while longer planning or research tasks still trigger memory retrieval, agent orchestration, and full intelligence logging.

---

## 7. What’s Always Automatic vs. Manual Controls
- **Automatic**: Learning scheduler, meta intelligence board, autonomous research loop, awareness/gap detection, vector memory updates, task memory analytics, skill evolution suggestions, self-reflection, log instrumentation, safety policies enforcement.
- **Manual**: Chat prompts, agent `execute` commands, explicit skill evolve actions, file edits, voice API key updates, training dataset exports.

---

## 8. Next Areas to Track (for further detail)
1. Keep `core/agent` loop and `finalizeExecution` as the single truth for every response.
2. Refine the multi-agent orchestration and tool permissions inside `agents/` + `tools/` while logging the holistic steps.
3. Expand dashboards with agent trace IDs, LLM call counts, and QoS metrics in UI (already available for the existing pipeline).
4. Continue monitoring Groq/OpenRouter/Gemini rate limits via server logs and ensure fast path logs 1 call per casual chat.

## 9. File-by-file Snapshot
Below sabhi important files ka current content summary hai jo abhi repo me present hain. Agar kisi file ka zikr nahi hai, to wo intentionally remove kar diya gaya hai (README, issue notes, etc.).

### Root-level files
- `JARVIS_BUILD_BLUEPRINT.md`: Project vision aur deployment roadmap, AI OS phases, and architecture signals. Use as single-point planning doc.
- `config.py`, `requirements.txt`, `run.py`: Python legacy FastAPI stack entrypoint/config/deps for the parallel runtime.
- `frontend/`: legacy React UI assets (if referenced by Python stack); now mostly dormant since Next.js UI runs from `react-assistant-ui`.
- `app/`: Python FastAPI application directory, contains its own chat/service layers mirroring TypeScript stack for fallback.

### `ts-backend/src`
- `server.ts`: Express entry-point, configures CORS, chat/agent/mentor routes, `/learning/file`, voice/tts APIs, startup logging, learning scheduler + periodic maintenance interval.
- `core/agent/controller.ts`: The intelligence hub—intent classification, fast vs strategic path, tool registration, agent orchestration points, finalizeExecution, logging, learning updates, meta/awareness/evolution results.
- `services/chatService.ts`: Chat session lifecycle, streaming (SSE) helpers, `BrainRouter` orchestration, fast/medium/deep path classification, memory recall injection.
- `guardrails/` (`input_filter.ts`, `policy_engine.ts`, `output_filter.ts`): Prompt risk scoring, policy routing, sanitization, and fallback logic.
- `agents/` (`agent_orchestrator.ts`, `planning_agent.ts`, `research_agent.ts`, etc.): Multi-agent orchestrator, agent base definitions, and activity persistence under `database/upgrade_data/agent_activity.json`.
- `planning/` + `tools/`: Task planner, step executor, plus secure tool router/executor/permissions for file/git/terminal/web operations.
- `learning/`, `memory/`, `intelligence/`, `task_memory/`: Continuous learning engine, dataset manager, knowledge extractor, vector memory, retrieval/context builder, intelligence graph, task history analytics.
- `skills/`, `curriculum/`, `meta_intelligence/`: Skill registry/evolution, curriculum tracker, meta controller, goal registry/scheduler/evaluator, long-term goals, awareness engine, self-improvement/evolution pipelines.
- `research/`, `autonomous_research/`, `self_improvement/`, `self_evolution/`: Research workers, topic detectors, knowledge builders, performance analytics, mistake detection, evolution proposals.
- `youtube_learning/`, `web_learning/`, `multimodal_learning/`: New learning pipelines that fetch YouTube transcripts, crawl documentation, and digest images/code; these agents normalise knowledge, persist JSON artifacts under `database/learning_runtime/`, update the vector store, and notify the Continuous Learning Engine via `ingestKnowledgeArtifact`.
- `routes/`, `core/safety`, `logging`, `training/`: Route modules for mentor/workspace/agent APIs, safety services, audit logs, training dataset exports, and telemetry collectors.
- `github_learning/`: Repository crawler, parser, analyzer, and agent for capturing GitHub knowledge; results feed vector memory + learning engine and live stats endpoint `/learning/github/stats`.
- `youtube_learning/`, `web_learning/`, `multimodal_learning/`: Libraries for processing YouTube transcripts, web documentation, and image/code assets plus their learning agents and JSON outputs.

### `react-assistant-ui`
- `src/app/page.tsx` & `src/app/layout.tsx`: Next.js App Router entry that renders `AstroDashboard` and applies global neon theme + Tailwind base styles.
- `src/components/dashboard/*`: Modular tabs (Overview, Chat, Agent, Skills, Files, Voice, Logs), each tied into backend endpoints and real-time WebSocket/voice updates.
- `src/components/ui/*`: Shadcn-inspired primitives (Button, Input, Card, Tabs, Switch, Badge, Separator) customized for TI theme.
- `src/lib/ttsPlayer.js`: Browser-safe TTS queue with fallback for SSR (guards `Audio`, `window`).
- `tailwind.config.cjs` + `postcss.config.cjs`: Style pipeline for animation/glow effects.

### `vscode-Astro-extension`
- `src/extension.ts`: VS Code activation, command registration, extension-level configuration, websocket connection to backend.
- `src/services/backendClient.ts`: Wrapped fetch + SSE helpers hitting `/chat`, `/agent`, `/mentor` endpoints.
- `src/features/astroCommands.ts`: Implementation of commands like explain/refactor/fix/analyze/snippet/git automation.
- `src/providers/liveMonitor.ts`: Typing detection, debounce, anti-pattern tracking, surprise question logic, developer memory persistence (`developerProfile.json`).
- `src/webview` (if present): Chat panel, live monitor view, voice controls mirrored from backend.

### Data directories referenced in code
- `database/chats_data/`, `memory_data/`, `dataset/`, `learning_runtime/`, `skills_data/`, `upgrade_data/`, `audit_logs/`: Each holds the persistence for sessions, memories, datasets, embeddings, skills, agent logs, self-improvement/evolution proposals.


Aaj ke instructions pe maine sab files ka ek high-level summary `details.md` me daal diya hai. Agar kisi file ka aur detail chahiye to uska path batao, main uske andar ka content section-by-section likh deta hoon.

Aaj ke update ke baad project pure tarike se `ts-backend/src` ke andar hi run karta hai; koi separate V3 folder nahin raha. Details file se future me aap architecture ko fast reference ke roop me use kar sakte ho.
