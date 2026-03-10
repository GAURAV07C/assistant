# ASTRO / JARVIS Detailed Implementation Report

Date: 2026-03-08

This report is based on the current code in this repo and explains:
- code me kya bana hai,
- usse system me kya capability aayi,
- real scenario me kaise kaam karta hai,
- Python stack ko separate karke.

---

## 1) Project Reality Snapshot

Current repo me 2 major runtime tracks exist karte hain:

1. TypeScript Track (primary advanced stack)
- `ts-backend/` (Node + TS backend, advanced agent/intelligence)
- `react-assistant-ui/` (dashboard/control UI)
- `vscode-Astro-extension/` (VS Code assistant extension)

2. Python Track (legacy/parallel stack, separate)
- `app/` + `run.py` + `config.py`
- Basic FastAPI + Groq + vector store chat stack

Is waqt advanced features mostly TypeScript stack me implemented hain.

---

## 2) TypeScript Backend (`ts-backend`) — What Exists and Why It Matters

### 2.1 Core API + Streaming + Session Layer

Key files:
- `ts-backend/src/server.ts`
- `ts-backend/src/services/chatService.ts`
- `ts-backend/src/services/groqService.ts`
- `ts-backend/src/services/realtimeService.ts`
- `ts-backend/src/services/ttsService.ts`

What code does:
- Chat endpoints non-stream and SSE stream dono run karte hain.
- Shared `session_id` persist hota hai (`database/memory_data/active_session.json`).
- Streaming me text chunks ke saath inline TTS audio chunks bhejne ka support hai.
- Extension-specific coding stream endpoints alag hain (`/extension/chat/*`).

What capability mila:
- Same assistant thread continue hota hai even across requests.
- Real-time text + optional voice output possible.
- UI aur extension dono same backend intelligence use kar sakte hain.

Scenario:
- User React UI me `/chat/stream` se prompt bhejta hai.
- Backend chunked response bhejta hai, audio chunks bhi bhej sakta hai.
- Session ID save hota hai, next message same context me जाता है.

---

### 2.2 Guardrails + Dual Brain Routing

Key files:
- `ts-backend/src/guardrails/input_filter.ts`
- `ts-backend/src/guardrails/policy_engine.ts`
- `ts-backend/src/guardrails/output_filter.ts`
- `ts-backend/src/core/agent/brain_router.ts`
- `ts-backend/src/core/agent/brain_a_llm.ts`
- `ts-backend/src/core/agent/brain_b_reasoning.ts`
- `ts-backend/src/core/safety/router_logs.ts`

What code does:
- Input ko risk category deta hai (`normal | research | risky`) with `risk_score`.
- Policy engine decide karta hai `normal`, `research`, ya `educational` route.
- Brain A = primary LLM path.
- Brain B = deeper reasoning/research-oriented path.
- Unsafe output sanitize hota hai.
- Routing decisions log hote hain.

What capability mila:
- Assistant blindly answer nahi karta; query type ke hisaab se brain select hota hai.
- Risky prompt par safe educational answer milta hai.

Scenario:
- User asks: "how to bypass safety prompt".
- Input filter risk detect karta hai.
- Policy `educational` decide karta hai.
- Output filter safe explanation return karta hai, actionable abuse steps nahi.

---

### 2.3 Agent Controller + Planning + Tool Orchestration

Key files:
- `ts-backend/src/core/agent/controller.ts`
- `ts-backend/src/planning/task_planner.ts`
- `ts-backend/src/planning/goal_parser.ts`
- `ts-backend/src/planning/step_executor.ts`
- `ts-backend/src/tools/file_tools.ts`
- `ts-backend/src/tools/git_tools.ts`
- `ts-backend/src/tools/terminal_tools.ts`
- `ts-backend/src/tools/web_tools.ts`

What code does:
- Intent classify karta hai (`coding/debugging/planning/git/...`).
- Complexity + ambiguity score karta hai.
- `casual` vs `strategic` mode select hota hai.
- Structured plan with tools build hota hai.
- Retry policy apply karta hai.
- Safety checks + audit ke saath tool execution karta hai.

What capability mila:
- "just chat" se aage: agentic plan + controlled execution.
- Ambiguous user query par clarification question auto-generate hoti hai.

Scenario:
- User: "refactor this module and improve safety".
- Agent plan बनाता है: analyze → refactor guidance → validation.
- If ambiguity high, pehle targeted question puchta hai.
- If clear, execution trace return karta hai.

---

### 2.4 Memory System (Structured + Long-Term)

Key file:
- `ts-backend/src/core/memory/memoryService.ts`

What code does:
- Generic memory records upsert karta hai (`namespace/key/value`).
- Coding style infer karta hai (indent, semicolon, naming).
- Skill progress text signals se track karta hai.
- Anti-pattern repetition counts maintain karta hai.
- Domain interest score maintain karta hai.
- Combined profile snapshot return karta hai.

What capability mila:
- Assistant user coding style aur recurring issues remember karta hai.
- Mentoring and suggestions contextual banti hain.

Scenario:
- User repeatedly callback-heavy code bhejta hai.
- `anti_patterns` me count badhta hai.
- 3+ repetition par warning-style advisory workflows trigger ho sakte hain.

---

### 2.5 Continuous Learning Engine (CLE)

Key files:
- `ts-backend/src/learning/continuous_learning_engine.ts`
- `ts-backend/src/learning/dataset_manager.ts`
- `ts-backend/src/learning/knowledge_extractor.ts`
- `ts-backend/src/learning/embedding_engine.ts`
- `ts-backend/src/learning/knowledge_graph.ts`
- `ts-backend/src/learning/behavior_learning.ts`
- `ts-backend/src/learning/micro_dataset_builder.ts`
- `ts-backend/src/learning/learning_scheduler.ts`

What code does:
- Conversations dataset JSONL format me store hoti hain.
- Knowledge extractor structured insights nikalta hai.
- Embeddings + knowledge graph update hota hai.
- Behavior profile update hota hai.
- Micro dataset exports training prep ke liye generate hote hain.
- Scheduler periodic cycle chalata hai.

What capability mila:
- Assistant static nahi, interaction-derived learning artifacts build karta hai.
- Future fine-tuning/micro-model prep possible hoti hai.

Scenario:
- User repeatedly architecture tradeoff discuss karta hai.
- Extractor `architecture_idea` insights create karta hai.
- Graph me system_design relations add hote hain.
- Curriculum aur reasoning context richer hota hai.

---

### 2.6 Research + Reasoning Stack

Key files:
- `ts-backend/src/research/research_engine.ts`
- `ts-backend/src/research/web_researcher.ts`
- `ts-backend/src/research/document_reader.ts`
- `ts-backend/src/research/knowledge_builder.ts`
- `ts-backend/src/reasoning/intent_analyzer.ts`
- `ts-backend/src/reasoning/task_planner.ts`
- `ts-backend/src/reasoning/brain_router.ts`
- `ts-backend/src/reasoning/reasoning_engine.ts`

What code does:
- New concept/research-like queries detect karke Tavily-based research try karta hai.
- Reasoning engine query augment karta hai using memory + optional research.
- Brain router complexity basis pe reasoning mode choose karta hai.

What capability mila:
- Complex query me assistant deeper response context build karta hai.

Scenario:
- User asks: "vector DB vs graph DB for code memory agent".
- Reasoning engine intent + plan बनाता है.
- Research summary attach hota hai (if available).
- Final response me structured tradeoff guidance aati hai.

---

### 2.7 Skill Evolution System (Latest Upgrade)

Key files:
- `ts-backend/src/skills/skill_registry.ts`
- `ts-backend/src/skills/skill_memory.ts`
- `ts-backend/src/skills/skill_learning.ts`
- `ts-backend/src/skills/skill_evolution.ts`
- `ts-backend/src/skills/skill_engine.ts`
- integrated in `ts-backend/src/core/agent/controller.ts`

What code does:
- Default skills register hote hain (`coding/research/automation/data_analysis/web_scraping/prompt_engineering`).
- Har skill ke liye dedicated memory store banta hai:
  - `database/skills_data/<skill>/concepts.json`
  - `tools.json`, `best_practices.json`, `examples.json`, `mistakes.json`
- Learning engine tasks/conversation se skill candidates detect karta hai.
- Evolution engine result feedback se `intelligence_score` aur level update karta hai.
- Levels: `beginner/intermediate/advanced/expert`.
- Agent run flow me auto learn + evolve integrated hai.

What capability mila:
- Skills static list nahi rahe; usage ke saath intelligence profile grow karta hai.
- Skill-specific memory knowledge base persist hota hai.

Scenario:
- User multiple API debugging tasks karta hai.
- `coding` skill usage count/intelligence score increment hota hai.
- Errors repeat hone par mistakes memory me add hoti hain.
- Success feedback par best-practices strengthen hoti hain.

---

### 2.8 Self Reflection + Evaluation + Curriculum

Key files:
- `ts-backend/src/core/self_reflection/*`
- `ts-backend/src/evaluation/*`
- `ts-backend/src/curriculum/*`
- `ts-backend/src/intelligence/intelligence_graph.ts`

What code does:
- Response quality scoring + performance metrics maintain hota hai.
- Reflection logs save hote hain.
- Skill graph se curriculum roadmap + next tasks generate hote hain.
- Intelligence graph concepts relations track karta hai.

What capability mila:
- Assistant recommendations coaching-style ban jati hain (next learning tasks).

Scenario:
- Recent executions low quality score dete hain.
- Curriculum engine next task suggest karta hai (e.g. testing + error handling drills).
- Dashboard me next recommended resource show hota hai.

---

### 2.9 Safety and Audit

Key files:
- `ts-backend/src/core/safety/safetyService.ts`
- `ts-backend/src/core/safety/auditService.ts`
- audit use in routes and agent tools

What code does:
- Risky actions ke लिए confirmation/restriction logic.
- Route/action-level audit logs maintain.
- Workspace file APIs me path safety checks apply.

What capability mila:
- Unsafe destructive operations accidental run hone ka risk kam.
- Action traceability available.

Scenario:
- Agent execute call me destructive flags without confirm.
- Safety block/needs_confirmation return karta hai.
- Audit log me blocked event capture hota hai.

---

### 2.10 Workspace File Editing APIs (React-controlled)

Key file:
- `ts-backend/src/routes/extensionRoutes.ts`

What code does:
- `GET /workspace/files` (editable files list)
- `GET /workspace/file` (file content read)
- `PUT /workspace/file` (save)
- Path sanitize, extension allowlist, size cap, audit applied.

What capability mila:
- Dashboard se direct project file editing possible ho gaya.

Scenario:
- User React panel se `src/App.jsx` load karta hai.
- Edit karta hai and Save click karta hai.
- Backend safe path validate karke file persist kar deta hai.

---

## 3) TypeScript API Surface (Practical)

Major routes currently exposed (high-value):
- Chat: `/chat`, `/chat/stream`, `/chat/realtime`, `/chat/realtime/stream`
- Extension streams: `/extension/chat/stream`, `/extension/chat/realtime/stream`
- Agent: `/agent/plan`, `/agent/execute`
- Mentor: `/mentor/code/explain`, `/mentor/code/refactor`, `/mentor/code/fix`, `/mentor/code/analyze`, `/mentor/snippet/generate`, `/mentor/git/commit-message`
- Memory/Audit: `/memory/upsert`, `/memory/profile`, `/audit/recent`
- Evolution: `/evolution/status`, `/reflection/recent`, `/curriculum/next`, `/router/stats`
- Skills: `/skills/list`, `/skills/detail/:skill_id`, `/skills/toggle`, `/skills/learn`, `/skills/evolve`, `/skills/execute`
- File editing: `/learning/file`, `/workspace/files`, `/workspace/file`
- Voice: `/voice/settings`, `/voice/custom`, `/tts`
- History/session: `/chat/history/:session_id`, `/session/active`

---

## 4) React Assistant UI (`react-assistant-ui`) — What Exists and Scenario

Key file:
- `react-assistant-ui/src/App.jsx`

### 4.1 Dashboard Areas
- EVOLUTION dashboard:
  - evaluation summary
  - active agents
  - curriculum next task/resources
  - skill graph snapshot
  - dual-brain router stats
  - recent reflections
  - implementation matrix (implemented/partial/planned)

Scenario:
- User wants to see "system kitna advanced hai".
- EVOLUTION panel one-screen maturity snapshot deta hai.

### 4.2 Skills Manager (new)
- `SKILLS` panel includes:
  - skill list + level + intelligence + enabled status
  - skill detail memory summary
  - toggle enable/disable
  - learn-from-task trigger
  - manual evolve (`success/partial/failure`)
  - execute skill test

Scenario:
- User manually "research" skill evolve करता है after good output.
- Intelligence score updates and reflected in list/detail.

### 4.3 Files Manager
- `Learning Files` mode:
  - create/open/save files in `database/learning_data`
- `Workspace Files` mode:
  - list/edit/save project files via backend safe APIs

Scenario:
- User wants to update `system_context.txt` aur project code without IDE switching.
- Same UI se dono possible.

### 4.4 Voice and User Controls
- Voice settings (built-in/custom)
- Custom voice upload config path
- Mic + loop listening + TTS fallback controls integrated in app logic

Scenario:
- User hands-free usage chahta hai.
- Mic input + streaming response + TTS playback flow support karta hai.

---

## 5) VS Code Extension (`vscode-Astro-extension`) — What Exists and Scenario

Core files:
- `src/extension.ts`
- `src/services/backendClient.ts`
- `src/features/astroCommands.ts`
- `src/providers/liveMonitor.ts`
- `src/intelligence/*`

### 5.1 Commands and Panels
- Chat panel, plan panel, suggestion panel.
- Commands for explain/refactor/fix/analyze/snippet/git automation/agent execute.
- Strategic/casual mode switch commands.

Scenario:
- Developer selected code pe `astro.refactorSelection` run karta hai.
- Backend mentor endpoint call hota hai.
- Suggested patch preview panel me दिखता hai.

### 5.2 Live Monitor Intelligence
- On file edits, debounce after typing streak.
- Bug-mode analysis API call.
- Diagnostics collection update.
- Anti-pattern detection + advisory trigger.
- Surprise questions with rate limit.
- Voice engine critical finding speak trigger.

Scenario:
- Developer rapid typing me hai.
- Live monitor immediate interrupt nahi karta.
- Pause ke baad analysis run hota hai aur meaningful diagnostics show karta hai.

### 5.3 Local Persistent Developer Memory (extension-side)
- `developerProfile.json` storage (skills, anti_patterns, style_preferences, improvement_score).
- Suggestion fixed hone par improvement score increment.

Scenario:
- Same bug type repeatedly aata hai.
- Profile anti-pattern count badhta hai.
- Later advisories more targeted ho jati hain.

---

## 6) Data Layer (`database/`) — What is Actually Stored

Observed folders used by code:
- `learning_data/` user/system text context
- `chats_data/` chat session JSON
- `memory_data/` memory store/profile/active session
- `audit_logs/` audit and router logs
- `dataset/` daily logs + conversation history + training category files
- `learning_runtime/` embeddings/knowledge graph/behavior profile
- `training_exports/` exported datasets
- `skill_progress/` skill graph/progress
- `skills_data/` (new skill-specific memory files)
- `skills_runtime/` (new skill registry runtime)
- `voice_data/` voice settings/custom profiles/samples

What this means:
- System ke almost sab intelligence layers persistent form me disk pe data maintain kar rahe hain.

---

## 7) Python Stack (Separate Section)

This section intentionally Python stack ko separate describe karta hai.

### 7.1 Python Architecture

Key files:
- `app/main.py`
- `app/services/chat_service.py`
- `app/services/groq_service.py`
- `app/services/realtime_service.py`
- `app/services/vector_store.py`
- `config.py`
- `app/models.py`

What code does:
- FastAPI server with `/chat`, `/chat/stream`, `/chat/realtime`, `/chat/realtime/stream`, `/tts`, `/health`, `/chat/history/{session_id}`.
- Vector store build from `learning_data` + `chats_data`.
- Groq primary-first multi-key fallback.
- Realtime Tavily search integration.
- Session management and JSON persistence.

What capability mila:
- Stable conversational + RAG + streaming stack as a standalone backend.

Scenario:
- User python server run karta hai (`run.py`).
- Chat request आता है without session id.
- New UUID session बनता है, response आता है, chat disk pe persist hoti hai.

### 7.2 Python vs TS state
- Python stack rich comments/documentation ke saath mature base hai.
- But advanced evolution systems (skills manager UI endpoints, phase-1 intelligence integration breadth) TypeScript stack me zyada आगे hain.

---

## 8) End-to-End Scenario Flows (Realistic)

### Scenario A: VS Code coding mentor + live monitor
1. Developer TS file edit karta hai.
2. Live monitor debounce ke baad bug analysis call करता hai.
3. Findings diagnostics me show hoti hain.
4. Repeated anti-pattern advisory trigger hota hai.
5. Developer command se refactor suggestion लेता hai.
6. Memory/style profile update hota hai.

Outcome:
- Assistant coaching + diagnostics + patch guidance ek flow me milti hai.

### Scenario B: React dashboard se full control
1. User `EVOLUTION` panel open karta hai.
2. Skills/curriculum/reflection/router stats देखता hai.
3. `SKILLS` panel me skill evolve karta hai.
4. `FILES` panel me workspace file direct edit/save karta hai.
5. Voice settings `USER` panel se tune karta hai.

Outcome:
- "Control center" style operational dashboard available.

### Scenario C: Agentic task execution
1. User `/agent/plan` query deta hai.
2. Contract generated: intent/complexity/plan/tools.
3. `/agent/execute` safe checks ke saath run karta hai.
4. Execution ke baad reflection, evaluation, curriculum, continuous learning update ho jata hai.

Outcome:
- Task execution only output nahi deta; intelligence artifacts bhi update karta hai.

### Scenario D: Skill Evolution loop
1. User repeated automation tasks discuss karta hai.
2. Skill learning engine `automation` detect karta hai.
3. Skill memory me concepts/tools/examples append hote hain.
4. Output quality basis par evolution score update.

Outcome:
- Skill level and intelligence score gradually improve over interactions.

---

## 9) Current Strengths and Current Gaps

### Strengths (code-backed)
- Broad modular architecture already present (guardrails, agent, learning, skills, curriculum, research, reflection).
- Extension + backend + React integration real and functional.
- Persistent data-backed intelligence layers implemented.
- Safe workspace file editing via dashboard now available.

### Gaps / Partial Areas
- Some advanced systems heuristic-heavy hain (fully autonomous deep research quality still tuning needed).
- Micro-model training orchestration currently dataset-prep centric hai (full model training loop nahi).
- Multiple overlapping modules exist (legacy + upgraded paths), future refactor me consolidation useful hoga.

---

## 10) Practical Conclusion

Aapka system ab simple chatbot nahi raha.
Current code base me ye clearly available hai:
- dual-brain safe routing,
- agent planning/execution,
- coding mentor + live monitor,
- persistent memory and audit,
- continuous learning artifacts,
- skill evolution lifecycle,
- dashboard-level operational control,
- extension-level developer workflow integration,
- Python stack as separate stable runtime track.

Short me: architecture ab "AI assistant" se "developer evolution platform" direction me effectively move kar chuka hai, with many modules already running in production-style flow.

---

## 11) API to Feature Mapping (Direct)

### Chat APIs
- `POST /chat`
  - File impact: `ts-backend/src/server.ts`, `services/chatService.ts`
  - Kya hota hai: standard non-stream answer with session continuity.
- `POST /chat/stream`
  - Kya hota hai: SSE chunks + optional inline TTS audio chunks.
- `POST /chat/realtime`
  - Kya hota hai: realtime mode (web-search enriched path).
- `POST /chat/realtime/stream`
  - Kya hota hai: realtime + streaming output.
- `POST /extension/chat/stream`, `POST /extension/chat/realtime/stream`
  - Kya hota hai: VS Code coding-focused stream channels.

### Agent APIs
- `POST /agent/plan`
  - File: `routes/extensionRoutes.ts`, `core/agent/controller.ts`
  - Kya hota hai: intent + complexity + plan + tool chain contract return.
- `POST /agent/execute`
  - Kya hota hai: safety-gated execution + trace + intelligence updates.

### Mentor APIs
- `POST /mentor/code/explain`
- `POST /mentor/code/refactor`
- `POST /mentor/code/fix`
- `POST /mentor/code/analyze`
- `POST /mentor/snippet/generate`
- `POST /mentor/git/commit-message`
  - Kya hota hai: code selection based targeted mentor outputs.

### Memory / Evolution APIs
- `POST /memory/upsert`
- `GET /memory/profile`
- `GET /audit/recent`
- `GET /evolution/status`
- `GET /reflection/recent`
- `GET /curriculum/next`
- `GET /router/stats`
  - Kya hota hai: profile + audit + evolution intelligence observability.

### Skills APIs (new)
- `GET /skills/list`
- `GET /skills/detail/:skill_id`
- `PUT /skills/toggle`
- `POST /skills/learn`
- `POST /skills/evolve`
- `POST /skills/execute`
  - Kya hota hai: dynamic skill lifecycle manage and inspect.

### File Control APIs
- `GET /learning/file`
- `PUT /learning/file`
- `GET /workspace/files`
- `GET /workspace/file`
- `PUT /workspace/file`
  - Kya hota hai: dashboard-driven editable knowledge files + project files.

### Voice APIs
- `GET /voice/settings`
- `PUT /voice/settings`
- `POST /voice/custom`
- `POST /tts`
  - Kya hota hai: voice config + synthesis + custom voice profile support.

---

## 12) File-Level “Isse Kya Ho Raha Hai” Quick Map

### TypeScript Backend
- `src/server.ts`
  - Central API bootstrapping and route wiring.
  - Isse kya ho raha: all systems single backend runtime me serve ho rahe.
- `src/routes/extensionRoutes.ts`
  - Extension and dashboard operational endpoints.
  - Isse kya ho raha: mentor/agent/memory/skills/file control APIs exposed.
- `src/core/agent/controller.ts`
  - Planning + tools + evaluation + learning orchestration.
  - Isse kya ho raha: request → execution → intelligence update full loop.
- `src/skills/*`
  - Skill registry/memory/learning/evolution/engine.
  - Isse kya ho raha: skills persist + evolve + executable ho gaye.
- `src/learning/*`
  - Dataset + extraction + embedding + graph + behavior.
  - Isse kya ho raha: continuous learning artifacts auto build ho rahe.
- `src/guardrails/*`
  - Input/output safety + policy routing.
  - Isse kya ho raha: risky input safe mode me convert ho raha.

### React UI
- `react-assistant-ui/src/App.jsx`
  - EVOLUTION dashboard + SKILLS manager + FILES editor + USER voice controls.
  - Isse kya ho raha: non-technical user bhi system ko operate/tune kar sakta.

### VS Code Extension
- `vscode-Astro-extension/src/extension.ts`
  - Extension activation and provider wiring.
- `src/features/astroCommands.ts`
  - Command palette workflows.
- `src/providers/liveMonitor.ts`
  - Passive code monitoring + diagnostics + advisory.
- `src/intelligence/*`
  - Intent router, behavior mode, anti-pattern tracker, surprise engine, voice engine, memory engine.
  - Isse kya ho raha: IDE ke andar adaptive mentor behavior mil raha.

### Python Stack (Separate)
- `app/main.py` + `app/services/*` + `config.py`
  - FastAPI + Groq + vector-store legacy/parallel runtime.
  - Isse kya ho raha: independent chat/realtime/tts backend bhi available hai.

---

## 13) Status Matrix (Implemented / Partial / Planned / Missing)

### Implemented
- Dual-brain guardrail routing with risky-input educational fallback.
- Agent planning and execution contract (`/agent/plan`, `/agent/execute`).
- Mentor endpoints for explain/refactor/fix/analyze/snippet/git message.
- Persistent memory + audit + router logs.
- Continuous learning data pipeline (dataset, extraction, embedding, graph, behavior).
- Evolution dashboard data APIs (`/evolution/status`, `/curriculum/next`, `/reflection/recent`).
- Skill Evolution System (registry, memory, learning, evolution, execute).
- React UI: Evolution + Skills + Files + Voice control panels.
- Workspace file read/write APIs with safety checks.
- VS Code extension live monitor + adaptive behavior + anti-pattern + surprise + voice trigger.

### Partial
- Autonomous research depth and factual expansion policy (available but heuristic-heavy).
- Self-reflection to curriculum feedback loop quality calibration.
- Multi-agent orchestration quality tuning (agents exist, deeper specialization tuning pending).
- Micro-dataset quality curation and de-dup sophistication.
- Cross-layer consistency (TS backend, extension, React all paths fully aligned for every edge case).

### Planned
- Full micro-model training runtime (currently dataset-prep centric).
- Skill marketplace/plugin installer style dynamic external skills.
- Stronger autonomous task chains with robust rollback/repair strategy.
- Advanced governance dashboards (operational SLOs, alerting, drift metrics).

### Missing (for strong Phase-1 closure)
- Single canonical architecture doc auto-synced with code changes.
- Full E2E test suite covering extension ↔ backend ↔ React critical flows.
- Clear deprecation strategy for Python legacy stack vs TS primary stack.
- Security hardening pass for public deployment mode (authn/authz/rate enforcement/IP controls).

---

## 14) Risk Matrix (Priority)

| Priority | Risk | Current Impact | Suggested Action |
|---|---|---|---|
| P0 | No full E2E regression suite | Breakages can slip between UI/extension/backend | Add automated E2E for chat, agent execute, skill evolve, workspace file save |
| P0 | Legacy Python + TS dual runtime confusion | Team may run wrong backend and see inconsistent behavior | Declare TS as primary runtime; mark Python as legacy in README |
| P1 | Heuristic-heavy autonomous research | Occasional low-quality or shallow research outputs | Add evaluation gates + source-quality scoring + fallback rules |
| P1 | Skill evolution scoring is simplistic | Skill level can over/under-shoot true capability | Add weighted scoring by task complexity and outcome quality |
| P1 | Workspace file editing safety scope | Powerful feature may be risky if exposed publicly | Keep local-only + add auth and strict allowlist in production |
| P2 | Dataset growth without lifecycle policy | Storage and quality drift over time | Add retention, compaction, dedupe, archive jobs |

---

## 15) Recommended Execution Order (Pragmatic)

1. Phase-1 Stabilization
- Freeze primary runtime to TS.
- Add E2E tests for top 10 user journeys.
- Add release checklist for backend + extension + React compatibility.

2. Quality Hardening
- Improve research quality scoring.
- Refine skill evolution metrics.
- Add richer failure analytics in audit/evaluation layer.

3. Intelligence Expansion
- Structured micro-model preparation policies.
- Advanced skill plugins.
- Autonomous chains with safer execution boundaries.

---

## 16) TypeScript vs Python (Final Comparison)

### Kya TypeScript stack Python se advanced hai?
Haan, current repo state me **TypeScript stack clearly zyada advanced** hai.

Reason:
- TS me agent controller + planning + execution + safety integration deeper hai.
- TS me skill evolution system live hai (learn/evolve/execute APIs + UI controls).
- TS me React dashboard aur VS Code extension dono strongly wired hain.
- TS me evolution/status/reflection/curriculum/skills observability endpoints available hain.

### Python stack ka role kya hai?
Python stack currently:
- solid baseline chat backend hai,
- RAG + realtime + TTS support karta hai,
- but advanced orchestration layers (skills manager, evolution dashboard controls, phase-1 intelligence breadth) TS jitne integrated nahi hain.

### Kya Python me koi aisa hai jo TS me nahi?
Practical terms me Python side ka strongest unique point:
- documentation/comment depth bahut high hai (learning-friendly explainability),
- architecture simple and focused hai (chat-first, less moving parts).

Feature depth ke level par (current codebase):
- jo major advanced capabilities aap build kar rahe ho (skills evolution, integrated agent intelligence, dashboard control plane), wo TS side me stronger hain.

### Recommendation
- **Primary runtime = TypeScript** rakho for advanced Jarvis roadmap.
- Python ko either:
  1) legacy fallback runtime rakho, ya
  2) separate “minimal chat service” mode me maintain karo.

---

## 17) Manual vs Automatic (Current Behavior)

### Manual (aapko karna hoga)
- System run karna:
  - Root se: `npm run dev` (backend + react UI + extension build watch)
  - Sirf backend: `npm run dev -w ts-backend`
- Personalization set karna (optional but recommended):
  - `POST /memory/upsert` me `namespace: "profile"` aur `value` me preferences store karo (example keys your profile value me): `response_style`, `depth`, `tone`.
  - Isse backend `applyPersonalStyle()` se prompt ko personal hints milte hain.
- Reminders/Tasks add karna (jab aap chaho):
  - `POST /assistant/reminders` se reminders create karo.
  - `PUT /assistant/reminders/:id/done` se complete mark karo.
- Skills ko manual control (jab aap explicit feedback dena chaho):
  - `POST /skills/evolve` (success/partial/failure) ya React `SKILLS` panel buttons.
  - `PUT /skills/toggle` se enable/disable.
- Files editing:
  - React `FILES` panel se learning files aur workspace files load/edit/save.
- Emergency cleanup (manual trigger):
  - `POST /memory/cleanup` ko aap immediate cleanup ke liye run kar sakte ho.

### Automatic (system khud karega)
- Chat + agent interactions persist honge (sessions + dataset logs + audit logs).
- Continuous learning pipeline auto update hogi (dataset -> insights -> embeddings -> knowledge graph -> behavior profile).
- Skill detect + learn + evolve auto hota rahega (especially agent executions ke baad).
- Daily digest auto-generate hota rahega:
  - Endpoint hit par (`GET /assistant/digest/daily`)
  - Background interval me bhi (server running ho to).
- Memory confidence calculation available hai (`GET /memory/confidence`), aur scheduled stale cleanup cycle run hota hai (server running ho to).
- Router logs + audit logs auto maintain hote hain.

### New APIs Added for Personal Assistant Behavior
- `GET /assistant/reminders`
- `POST /assistant/reminders`
- `PUT /assistant/reminders/:id/done`
- `GET /assistant/digest/daily`
- `GET /memory/confidence`
- `POST /memory/cleanup`

These APIs make assistant ko proactive + self-maintaining banane ka base provide karti hain.

---

## 18) Chat System Update (Natural Assistant Behavior)

### Problem jo aa raha tha
- Simple greeting (`Hlo`, `Hi`) par response over-formal aa raha tha:
  - `Problem Framing`
  - `Ambiguity`
  - `Clarification`
- User experience chatbot jaisa nahi, report-template jaisa lag raha tha.

### Root Cause
- `adaptForAgent()` har message par internal contract banata hai.
- Short messages ambiguity score high le rahe the.
- High ambiguity ke wajah se strategic/clarification path trigger ho raha tha.
- Prompt style strategic mode me pehle structured-report oriented tha.

### Fixes Implemented (TS Backend)
- File: `ts-backend/src/core/agent/controller.ts`
  - `isSmallTalk(...)` detector add:
    - `hlo`, `hi`, `hello`, `ok`, `thanks`, `haan`, `how are you`, etc.
  - `classifyIntent(...)`:
    - small talk => `casual_conversation`
  - `scoreAmbiguity(...)`:
    - small talk => low ambiguity
  - `selectMode(...)`:
    - small talk => force `casual`
  - `needsClarification(...)`:
    - casual conversation ke liye clarification disable
  - `mapMessageForMode(...)`:
    - small-talk ke liye direct natural 1-2 line response instructions
    - strategic mode me bhi rigid template headings remove
    - assistant-like direct answer first policy

- File: `ts-backend/src/server.ts`
  - `adaptForAgent()` now passes detected intent into `mapMessageForMode(...)`
  - Result: prompt generation mode + intent aware ho gaya.

### Current Chat Decision Pipeline
1. User message आता है (`/chat*` endpoints).
2. Contract build होता है:
   - intent
   - complexity
   - ambiguity
   - selected mode (casual/strategic)
3. Clarification gate:
   - only if non-casual + high ambiguity
4. Mode-aware response prompt बनता है.
5. Personal profile hints apply होते हैं (`applyPersonalStyle`).
6. LLM response आता है (stream/non-stream/realtime).

### Expected Behavior Now
- Greeting:
  - input: `Hlo`
  - output: short natural assistant reply
  - no formal headings

- Technical task:
  - input: `refactor auth middleware and add retry`
  - output: direct actionable response, strategic depth auto-selected

- Very vague execution request:
  - input: `ye implement kar do`
  - output: targeted clarification (only where needed)

### Related Documentation
- Full chat-system problem note:
  - `problem.md`

---

## 19) Chat Complete Map (Kon Kon Sa Kya Kya Hai)

### A) Chat APIs (TS Backend)
- `POST /chat`
  - General non-stream chat response.
- `POST /chat/realtime`
  - Realtime non-stream path.
- `POST /chat/stream`
  - SSE stream response + optional inline TTS chunks.
- `POST /chat/realtime/stream`
  - Realtime SSE stream + optional inline TTS chunks.
- `POST /extension/chat/stream`
  - VS Code extension coding-focused stream route.
- `POST /extension/chat/realtime/stream`
  - VS Code extension coding-focused realtime stream route.
- `GET /chat/history/:session_id`
  - Session chat history read.
- `GET /session/active`
  - Current shared active session read.
- `PUT /session/active`
  - Active session manually set.

### B) Backend Chat Core Files
- `ts-backend/src/server.ts`
  - Chat routes, SSE stream setup, agent adaptation, personalization hooks.
- `ts-backend/src/services/chatService.ts`
  - Core chat/realtime/stream methods + session persistence.
- `ts-backend/src/core/agent/controller.ts`
  - Intent, complexity, ambiguity, mode switch, clarification gate, response style mapping.

### C) Auto Decision Layer (Agent + Chat Routing)
- Message first `adaptForAgent(...)` se pass hota hai.
- Contract auto-generate hota hai:
  - intent
  - complexity_score
  - ambiguity_score
  - selected_mode (`casual` / `strategic`)
- Clarification gate run hota hai:
  - casual conversation par clarification skip
  - ambiguous technical request par targeted clarification
- Final prompt `mapMessageForMode(...)` se style-aware banta hai.

### D) Response Style System
- `small-talk` path:
  - short, natural, assistant-like response
  - no rigid headings
- `casual` mode:
  - concise normal chat tone
- `strategic` mode:
  - direct answer first
  - then required steps/tradeoffs
  - clarification only when critical input missing

### E) Personalization Layer
- `applyPersonalStyle(...)` profile memory se hints inject karta hai.
- Preferred style/depth/tone + coding style (indentation/naming/semicolon) context me add hota hai.
- Ye hints prompt me internal hoti hain; final user response me expose nahi hoti.

### F) Streaming + TTS Layer
- SSE helpers (`sseWrite`, `setupSse`, `streamGenerator`) stream packets bhejte hain.
- Optional inline TTS sentence chunking + queue flush support.
- React UI me local fallback TTS player (`react-assistant-ui/src/lib/ttsPlayer.js`) hai.
- Voice settings + custom voice routes:
  - `GET/PUT /voice/settings`
  - `POST /voice/custom`

### G) Session & Persistence
- Session ID resolve flow:
  - request session_id
  - shared active session
  - fallback new session
- Chat sessions disk pe save hoti hain (`saveChatSession(...)`).
- Audit logs per chat route maintained.
- History endpoint se full conversation recall available.

### H) Safety + Clarification Behavior
- Unsafe/ambiguous action ke liye clarification-first flow.
- Casual greetings ke liye safety-compatible natural bypass.
- Agent execution path me tool failures par clarification + retry-policy alignment.

### I) React UI Chat Integration
- File: `react-assistant-ui/src/components/AstroDashboard.tsx`
  - chat composer, stream rendering, mode switch, agent run, mic flow.
- Chat tab:
  - input -> `/chat/stream` या `/chat/realtime/stream`
  - streamed chunks UI transcript me append.
- Agent tab:
  - `/agent/plan` and `/agent/execute` integrated panel.

### J) VS Code Extension Chat Integration
- `vscode-Astro-extension/src/services/backendClient.ts`
  - stream chat, routed chat, plan/execute calls.
- `vscode-Astro-extension/src/panels/chatViewProvider.ts`
  - webview chat UX + mode toggle + agent actions.
- Extension mode hint:
  - strategic/casual mode message prefix se backend behavior align hota hai.

### K) Chat Scenarios (Current)
- Scenario 1: Greeting
  - Input: `Hlo`
  - Output: natural short conversational response.
- Scenario 2: Coding task
  - Input: `refactor auth middleware and add tests`
  - Output: strategic actionable answer, likely stepwise.
- Scenario 3: Ambiguous execution
  - Input: `ye implement kar do`
  - Output: targeted clarification question.
- Scenario 4: Extension coding stream
  - VS Code message -> `/extension/chat/stream`
  - coding-focused response stream.

---

## 20) React UI Upgrade Details (Latest)

### A) Migration Summary
- UI stack migrated to Next.js App Router + TypeScript components.
- Old single-file `App.jsx` pattern replaced by `AstroDashboard.tsx` entry component.
- Dashboard now modular tab-based architecture me split hai.

### B) Next.js App Structure
- `react-assistant-ui/src/app/page.tsx`
  - Next route entry; `AstroDashboard` render karta hai.
- `react-assistant-ui/src/app/layout.tsx`
  - Root layout + global theme classes.
- `react-assistant-ui/src/app/globals.css`
  - Tailwind layers + theme CSS variables + background atmosphere styles.

### C) Modular Dashboard Components
- Main orchestrator:
  - `react-assistant-ui/src/components/AstroDashboard.tsx`
  - State, API calls, mode switching, stream orchestration yaha hota hai.
- Layout:
  - `react-assistant-ui/src/components/dashboard/DashboardShell.tsx`
  - `react-assistant-ui/src/components/dashboard/DashboardHeader.tsx`
- Tabs:
  - `OverviewTab.tsx`
  - `ChatTab.tsx`
  - `AgentTab.tsx`
  - `SkillsTab.tsx`
  - `FilesTab.tsx`
  - `VoiceTab.tsx`
  - `LogsTab.tsx`
  - Path: `react-assistant-ui/src/components/dashboard/tabs/`

### D) UI Design System (Shadcn-style + Tailwind)
- UI primitives:
  - `react-assistant-ui/src/components/ui/button.tsx`
  - `react-assistant-ui/src/components/ui/input.tsx`
  - `react-assistant-ui/src/components/ui/textarea.tsx`
  - `react-assistant-ui/src/components/ui/card.tsx`
  - `react-assistant-ui/src/components/ui/badge.tsx`
  - `react-assistant-ui/src/components/ui/tabs.tsx`
  - `react-assistant-ui/src/components/ui/switch.tsx`
  - `react-assistant-ui/src/components/ui/separator.tsx`
- Tailwind config:
  - `react-assistant-ui/tailwind.config.cjs`
  - `react-assistant-ui/postcss.config.cjs`
- Shadcn config link:
  - `react-assistant-ui/components.json`

### E) Dashboard Capabilities Visible in UI
- `Overview`:
  - system snapshot, feature matrix, evolution/curriculum/router snapshots.
- `Chat`:
  - streaming transcript, composer, mic trigger, plan/agent-run shortcuts.
- `Agent`:
  - plan + execute output, reflection + plan breakdown.
- `Skills`:
  - list/select/enable-disable/evolve/test skill actions.
- `Files`:
  - learning files + workspace files read/edit/save.
- `Voice`:
  - voice mode/settings, custom voice upload, loop controls.
- `Logs`:
  - audit logs + memory profile inspector.

### F) Runtime Stability Fixes in UI
- SSR-safe TTS:
  - `react-assistant-ui/src/lib/ttsPlayer.js` now guards `Audio`/`window` for Next SSR.
- Config compatibility:
  - CommonJS config files renamed to `.cjs` for Next + `type: module` compatibility.
- Network-safe startup checks:
  - `predev/prebuild/prestart` uses `scripts/ensure-next.mjs` to fail with clear guidance if Next missing.
- File action wiring fix:
  - Files tab create action uses `createOrOpenLearningFile` correctly.

### G) Root Monorepo Run Behavior
- Root workspace scripts:
  - `npm run dev` -> backend + UI + extension watch parallel.
  - `npm run dev:ui` -> only Next UI (`localhost:5174`).
- UI package scripts in `react-assistant-ui/package.json`:
  - `dev`, `build`, `start`, plus prechecks.

### H) Known Practical Constraints
- If network unstable ho, `npm install` may fail (`ETIMEDOUT`) and UI start blocked ho sakta hai.
- Current configs me install reliability improve karne ke liye root `.npmrc` hardening set hai.

---

## 21) Chat + UI Integration (All Updated Points)

### A) Backend to UI Chat Contract
- UI message send:
  - General stream -> `/chat/stream`
  - Realtime stream -> `/chat/realtime/stream`
- Backend stream packets:
  - `chunk` (text token/segment)
  - `citations` + `confidence` meta
  - optional `audio` base64 sentence chunk
  - `done` flag + `session_id`
- UI transcript:
  - stream chunks append होते हैं
  - final state on `done` close होता है

### B) UI Mode Controls (Now Connected)
- Chat mode (`general` / `realtime`) UI toggle backend endpoints switch karta hai.
- Agent mode (`casual` / `strategic`) backend prompt style behavior change karta hai.
- Plan + Execute actions directly agent endpoints call karti hain:
  - `/agent/plan`
  - `/agent/execute`

### C) Clarification + Natural Reply Behavior
- Greeting/small-talk:
  - now casual natural assistant reply
  - no formal report headings
- Ambiguous technical tasks:
  - targeted clarification question
- UI me agent payload summary visible hoti hai:
  - clarification
  - plan
  - execution details

### D) Voice + Chat Sync in UI
- UI TTS layer:
  - `react-assistant-ui/src/lib/ttsPlayer.js`
- Behavior:
  - backend audio chunks aaye to queue play
  - fallback speech synthesis for text-only cases
  - mute/unmute + voice loop controls
- SSR-safe guards already applied for Next runtime.

### E) UI Panels that Drive Chat Ecosystem
- `ChatTab`:
  - core conversation + composer + send/plan/agent-run
- `AgentTab`:
  - plan/evaluation/steps visibility
- `SkillsTab`:
  - learn/evolve/execute skill calls
- `FilesTab`:
  - learning/workspace data editing for assistant context
- `VoiceTab`:
  - voice settings + custom voice upload
- `LogsTab`:
  - audit + memory inspection for debugging chat behavior

### F) Extension + UI + Backend Alignment
- VS Code extension routes coding chat via:
  - `/extension/chat/stream`
  - `/extension/chat/realtime/stream`
- React UI routes general assistant chat via:
  - `/chat*` endpoints
- Dono same backend intelligence layers share karte hain:
  - intent routing
  - mode adaptation
  - personalization hints
  - audit trail

### G) Practical Run Path
- Root install:
  - `npm install`
- Full stack:
  - `npm run dev`
- UI only:
  - `npm run dev:ui`
- Backend only:
  - `npm run dev:backend`

### H) Files to Track for Chat/UI Issues
- Backend:
  - `ts-backend/src/server.ts`
  - `ts-backend/src/core/agent/controller.ts`
  - `ts-backend/src/services/chatService.ts`
- UI:
  - `react-assistant-ui/src/components/AstroDashboard.tsx`
  - `react-assistant-ui/src/components/dashboard/tabs/ChatTab.tsx`
  - `react-assistant-ui/src/lib/ttsPlayer.js`
- Extension:
  - `vscode-Astro-extension/src/services/backendClient.ts`
  - `vscode-Astro-extension/src/panels/chatViewProvider.ts`

---

## 18) Latest Addendum (2026-03-08 14:54:45 UTC) — Autonomous Multi-Agent + Awareness Upgrade

Ye section latest code changes cover karta hai jo pehle detail report me fully capture nahi the.

### 18.1 New Meta Intelligence Layer

New files:
- `ts-backend/src/meta_intelligence/meta_controller.ts`
- `ts-backend/src/meta_intelligence/goal_manager.ts`
- `ts-backend/src/meta_intelligence/learning_manager.ts`
- `ts-backend/src/meta_intelligence/skill_manager.ts`
- `ts-backend/src/meta_intelligence/system_optimizer.ts`

Code effect:
- System state (evaluation score, skill intelligence, repeated mistakes, research gaps) analyze hota hai.
- Learning goals auto-generate hote hain.
- Skill-upgrade actions suggest hote hain.
- Optimizer directives generate hote hain (reasoning depth/tool reliability).
- Meta intelligence score persist hota hai (`database/upgrade_data/meta_intelligence_state.json`).

Scenario:
- Agar recent quality score low hai + mistakes repeat ho rahe hain,
- to meta layer `high-priority learning goals` create karta hai and suitable agents assign karta hai.

### 18.2 Multi-Agent Orchestrator Upgrade

New/updated files:
- `ts-backend/src/agents/agent_orchestrator.ts` (new main orchestrator)
- `ts-backend/src/agents/planning_agent.ts`
- `ts-backend/src/agents/debug_agent.ts`
- `ts-backend/src/agents/evaluation_agent.ts`
- `ts-backend/src/agents/multi_agent_orchestrator.ts` (compat wrapper)

Code effect:
- Request ko subtasks me decompose kiya jata hai.
- Har step ko relevant agent assign hota hai.
- Outputs collect hote hain.
- End me evaluation agent quality verify karta hai.
- Agent activity log persist hota hai (`database/upgrade_data/agent_activity.json`).

Scenario:
- User complex request deta hai (“plan + research + implementation + debug”).
- Planning agent steps banata hai.
- Research + coding + debug agents parallel style assignment path pe run hote hain.
- Evaluation agent final quality summary add karta hai.

### 18.3 Autonomous Research Loop

New files:
- `ts-backend/src/autonomous_research/research_scheduler.ts`
- `ts-backend/src/autonomous_research/topic_detector.ts`
- `ts-backend/src/autonomous_research/knowledge_builder.ts`

Code effect:
- New/important topic detect karke autonomous research cycle run hota hai.
- Tavily-based research se topic knowledge fetch hoti hai.
- Latest cycle result persist hota hai (`database/upgrade_data/autonomous_research.json`).

Scenario:
- User “latest AI trend” ya “compare framework” type request deta hai.
- Topic detector trigger karta hai.
- Research scheduler summary + sources build karta hai.

### 18.4 Self-Improvement Loop

New files:
- `ts-backend/src/self_improvement/performance_analyzer.ts`
- `ts-backend/src/self_improvement/mistake_detector.ts`
- `ts-backend/src/self_improvement/improvement_planner.ts`

Code effect:
- Evaluation + reflection + tool failures se performance snapshot बनता hai.
- Mistake patterns detect होते hain.
- Improvement priorities/actions plan generate hota hai.
- Plan persist hota hai (`database/upgrade_data/self_improvement_plan.json`).

Scenario:
- Agar tool failures high hain, plan auto suggest karta hai: pre-checks/fallback/retry policy tighten.

### 18.5 Skill Growth Integration (Learning Link)

Updated file:
- `ts-backend/src/learning/continuous_learning_engine.ts`

Code effect:
- Ingest cycle अब `skill_categories` detect karta hai.
- Categories (`coding/research/automation/analysis/productivity`) controller ko milti hain.
- Controller in categories ke basis par further skill learning trigger karta hai.

Scenario:
- Conversation mostly debugging + architecture ho,
- to learning cycle automatically relevant skill categories push karta hai and skill memory enrich hoti hai.

### 18.6 Self-Awareness System (NEW)

New files:
- `ts-backend/src/awareness/self_awareness_engine.ts`
- `ts-backend/src/awareness/knowledge_gap_detector.ts`
- `ts-backend/src/awareness/curiosity_engine.ts`
- `ts-backend/src/awareness/question_generator.ts`
- `ts-backend/src/awareness/awareness_state.ts`

Code effect:
- System known concepts vs current request/response compare karta hai.
- Knowledge gaps detect hote hain.
- Curiosity score compute hota hai.
- Learning questions auto-generate hote hain.
- Awareness state persist hota hai (`database/upgrade_data/awareness_state.json`).

Scenario:
- Naya concept discuss hota hai jo graph me known nahi.
- Gap detector us concept ko mark karta hai.
- Curiosity engine us gap ko learning focus banata hai.
- Question generator targeted questions banata hai.

### 18.7 Controller + Status API Impact

Updated file:
- `ts-backend/src/core/agent/controller.ts`

New integration points:
- agent orchestration output usage
- autonomous research cycle trigger
- self-improvement planning trigger
- meta intelligence analysis trigger
- awareness evaluation trigger
- periodic autonomous maintenance method added

`/evolution/status` now includes extra blocks:
- `agent_activity`
- `autonomous_research`
- `self_improvement`
- `meta_intelligence`
- `awareness`
- `system_intelligence_score`

### 18.8 Dashboard (React) Upgrade for New Systems

Updated file:
- `react-assistant-ui/src/components/dashboard/tabs/OverviewTab.tsx`

UI now shows:
- system intelligence score
- active agents + recent runs
- meta intelligence snapshot
- autonomous research snapshot
- self-improvement snapshot
- awareness engine snapshot (curiosity score, gaps, generated questions)

### 18.9 Build/Type Safety Hardening During Upgrade

Updated files (UI runtime/type fixes):
- `react-assistant-ui/src/components/AstroDashboard.tsx`
- `react-assistant-ui/src/components/ui/button.tsx`
- `react-assistant-ui/src/components/ui/badge.tsx`
- `react-assistant-ui/src/components/ui/card.tsx`
- `react-assistant-ui/src/components/ui/separator.tsx`
- `react-assistant-ui/src/components/ui/switch.tsx`
- `react-assistant-ui/src/components/ui/tabs.tsx`
- `react-assistant-ui/src/components/ui/input.tsx`
- `react-assistant-ui/src/components/ui/textarea.tsx`
- `react-assistant-ui/src/lib/ttsPlayer.js` (SSR-safe Audio guard)

Validation status:
- `ts-backend`: `npm run typecheck` passed
- `react-assistant-ui`: `npm run build` passed

### 18.10 Automatic vs Manual (Latest Upgrades)

Automatic:
- Meta-intelligence goal generation
- Autonomous topic detection/research cycle
- Self-improvement plan refresh
- Awareness state/gap/question updates
- Agent activity logging
- Periodic autonomous maintenance (server interval)

Manual:
- Skills manual evolve/toggle from API/UI
- Explicit agent execute calls for user task
- Learning file/workspace file manual edits
- Voice config/customization toggles


---

## 19) Latest Addendum (2026-03-08) — ASTRO / JARVIS v2 Systems Upgrade

Is section me v2 upgrade ke latest code changes capture hain jo abhi implement hue.

### 19.1 Vector Memory + RAG Layer Added

New files:
- `ts-backend/src/memory/vector_store.ts`
- `ts-backend/src/memory/semantic_search.ts`
- `ts-backend/src/memory/retrieval_engine.ts`
- `ts-backend/src/memory/context_builder.ts`

What implemented:
- lightweight embedding generation + vector storage
- semantic similarity search
- retrieval engine for query-time context fetch
- context builder jo LLM prompt me retrieved memory inject karta hai

Runtime behavior:
- Agent run ke time user query ka semantic retrieval hota hai.
- Retrieved context synthesis prompt me prepend hota hai.
- Har run ke baad interaction vector memory me upsert hoti hai.

Data:
- `database/upgrade_data/vector_memory_store.json`

---

### 19.2 Long-Term Goal System Added

New files:
- `ts-backend/src/goals/goal_registry.ts`
- `ts-backend/src/goals/goal_scheduler.ts`
- `ts-backend/src/goals/goal_tracker.ts`
- `ts-backend/src/goals/goal_evaluator.ts`

What implemented:
- default long-term goals bootstrap
- goal scheduling by priority
- progress tracking from runtime metrics
- completion/progress evaluation summary

Example goals active:
- improve coding intelligence
- improve debugging skills
- improve research depth

Data:
- `database/upgrade_data/long_term_goals.json`

---

### 19.3 Secure Agent Tool Router Added

New files:
- `ts-backend/src/tools/tool_router.ts`
- `ts-backend/src/tools/tool_registry.ts`
- `ts-backend/src/tools/tool_executor.ts`
- `ts-backend/src/tools/tool_permissions.ts`

What implemented:
- tool registry abstraction
- per-agent tool permission map
- timeout-aware safe execution wrapper
- routing gate (permission deny if tool not allowed)

Integration:
- `AgentController.executeWithRetry()` ab secure tool router se run karta hai.
- Intent -> agent mapping ke basis pe permission apply hoti hai.

---

### 19.4 Task Memory System Added

New files:
- `ts-backend/src/task_memory/task_store.ts`
- `ts-backend/src/task_memory/task_patterns.ts`
- `ts-backend/src/task_memory/task_success_rate.ts`
- `ts-backend/src/task_memory/task_reuse.ts`

What implemented:
- task execution logs store (request/intent/success/score/tools/outcome)
- repeated intent/tool usage pattern detection
- aggregate success-rate analytics
- successful prior solutions ke reuse suggestions

Data:
- `database/upgrade_data/task_memory.jsonl`

---

### 19.5 Recursive Self-Improvement (Proposal-Only) Added

New files:
- `ts-backend/src/self_evolution/architecture_analyzer.ts`
- `ts-backend/src/self_evolution/code_optimizer.ts`
- `ts-backend/src/self_evolution/performance_monitor.ts`
- `ts-backend/src/self_evolution/evolution_planner.ts`
- `ts-backend/src/self_evolution/upgrade_executor.ts`

What implemented:
- architecture weakness detection
- code optimization suggestion generation
- performance health snapshot
- upgrade planning
- proposal publishing to upgrade pipeline record

Safety rule followed:
- direct production code modify nahi hota
- sirf proposal generate/store hota hai

Data:
- `database/upgrade_data/evolution_proposals.json`

---

### 19.6 Controller Integration Upgraded (v2)

Updated file:
- `ts-backend/src/core/agent/controller.ts`

New runtime integrations:
- semantic retrieval + context injection before final synthesis
- vector memory upsert per execution
- secure tool routing/permission enforcement
- goal tracking + evaluation updates
- task memory logging + analytics + reuse candidate calculation
- self-evolution proposal pipeline run

`intelligence_update` additions:
- `goal_progress_score`
- `task_success_rate`
- `evolution_proposal_id`
- `task_reuse_candidates`

---

### 19.7 Evolution Status Expanded (v2 observability)

`getEvolutionStatus()` now also returns:
- `vector_memory`
- `long_term_goals`
- `task_memory`
- `self_evolution`

This is in addition to existing blocks:
- `meta_intelligence`, `autonomous_research`, `self_improvement`, `awareness`, etc.

---

### 19.8 Dashboard Expansion Implemented

Updated file:
- `react-assistant-ui/src/components/dashboard/tabs/OverviewTab.tsx`

New visible panels:
- Vector Memory stats
- Long-Term Goals progress
- Task Memory analytics
- Evolution Proposals (JSON preview)

Existing advanced panels retained:
- Meta Intelligence
- Autonomous Research
- Self-Improvement
- Awareness
- System Intelligence Score

---

### 19.9 Validation (post v2 upgrade)

Executed checks:
- `cd ts-backend && npm run typecheck` -> passed
- `cd react-assistant-ui && npm run build` -> passed

Result:
- v2 modules compile correctly
- dashboard builds with new observability sections

