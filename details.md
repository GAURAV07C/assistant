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
6. **Research, Reflection & Evolution (`research/`, `self_improvement/`, `self_evolution/`)**
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
- `/chat/*`, `/chat/realtime/*`, `/agent/plan`, `/agent/execute`, `/mentor/*`, `/memory/*`, `/skills/*`, `/learning/file`, `/voice/*`, `/tts`, `/audit/recent`, `/evolution/status` all draw from the above modules.
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


Aaj ke update ke baad project pure tarike se `ts-backend/src` ke andar hi run karta hai; jo higher-level “AI_OS_V3” persona hai wo architecture ke naam ke roop me exist karta hai, par koi extra folder nahi raha. Details file se future me aap architecture ko fast reference ke roop me use kar sakte ho.
