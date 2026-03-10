# JARVIS Build Blueprint

## Goal
Build an AI that behaves like a human-level personal assistant + dev mentor with memory, reasoning, tooling, multimodal capabilities, and safe self-upgrade.

## Non-Negotiables
- Keep current frontend working without edits.
- Keep shared storage in root `database/`.
- Use TypeScript backend as primary orchestrator.
- Enforce safety gates before execution. 

## Phase Plan

### Phase 1 (Foundation, V1)
Focus: usable daily assistant + coding mentor.

1. Agent Controller
- Intent detection: chat, coding, docs, realtime search, media.
- Task planner: single-step + multi-step plans.
- Tool router: deterministic fallback rules.

2. Memory System
- Short-term: session-level memory (existing `chats_data`).
- Long-term: user profile/preferences (`learning_data` + new memory store).
- Coding memory: naming style, framework preferences, anti-patterns.

3. Coding Mentor Tools
- Explain selected code.
- Refactor suggestions.
- Bug-fix suggestions with rationale.
- Skill-level tagging and mentoring mode.

4. Documentation RAG
- Index project docs, API docs, references.
- Retrieval confidence and source-citation in responses.
- Hallucination guard (low-confidence fallback behavior).

5. Safety and Control
- Tool permission map.
- File path allow-list.
- Action audit logs.

6. Guardrail + Dual-Brain Routing System (Phase 1 Upgrade)
- Add pre-LLM input filtering and post-LLM output filtering.
- Add policy engine that decides route strategy before response generation.
- Add dual-brain router:
  - Brain A: primary LLM path for normal requests.
  - Brain B: research/reasoning path for complex queries.
- Enforce fallback:
  - risky queries -> educational safe explanation.
  - Brain A failure/refusal -> fallback to Brain B.
- Log every route decision for learning and audits.

Phase 1 routing flow:
User
-> Input Filter
-> Policy Engine
-> Brain Router (Brain A / Brain B)
-> Output Filter
-> Response

Phase 1 module files (TypeScript backend):
- `ts-backend/src/guardrails/input_filter.ts`
- `ts-backend/src/guardrails/policy_engine.ts`
- `ts-backend/src/guardrails/output_filter.ts`
- `ts-backend/src/core/agent/brain_router.ts`
- `ts-backend/src/core/agent/brain_a_llm.ts`
- `ts-backend/src/core/agent/brain_b_reasoning.ts`
- `ts-backend/src/core/safety/router_logs.ts`

Input Filter output contract:
```json
{
  "query": "...",
  "category": "normal | research | risky",
  "risk_score": 0
}
```

Policy rules:
- normal -> Brain A
- complex/research -> Brain B
- risky -> transform to safe educational explanation

Output Filter requirements:
- scan generated response for unsafe instructions
- strip/transform risky output
- enforce explanation-first safe response style

### Phase 2 (Expansion)
Focus: multimodal and domain intelligence.

1. Multimodal
- Image generation.
- Voice I/O pipeline.
- Video generation/editing pipeline.
- 3D pipeline (queue-based plugin architecture).

2. Domain Intelligence
- Finance/crypto/marketing connectors.
- Realtime data summarization.
- Recommendation layer with source traces.

3. Digital Identity v1
- Persistent persona config.
- Voice profile.
- Web identity profile metadata.

### Phase 3 (Self-Upgrade + Evolution)
Focus: safe experimentation and adaptive growth.

1. Experimental Clone Runtime
- Isolated candidate configs/models.
- Task replay against benchmark prompts.
- Quality scoring and regression detection.

2. Merge Controller
- Gate by tests + eval metrics.
- Human approval required.
- Automatic rollback on degradation.

3. Intelligence Growth
- Weekly growth report.
- Skill trend + behavior insight.
- Personalized adaptive strategy.

## Target Backend Modules (TypeScript)

Use these modules under `ts-backend/src/`:
- `core/agent/` intent + planning + routing
- `core/memory/` short/long-term memory interfaces
- `core/tools/` code tools + command tools
- `core/rag/` ingestion + retrieval + confidence
- `core/multimodal/` image/audio/video/3d adapters
- `core/identity/` persona + voice + avatar state
- `core/domain/` finance/marketing/web3 intelligence
- `core/upgrade/` experimental clone + merge pipeline
- `core/safety/` permission engine + sandbox policies
- `core/eval/` quality metrics + benchmark harness

## Data Model (Shared Root Database)

Keep all under root `database/`:
- `learning_data/` user profile and preferences
- `chats_data/` conversation sessions (existing)
- `memory_data/` long-term structured memory
- `audit_logs/` action and tool execution logs
- `eval_data/` benchmark results and weekly reports
- `upgrade_data/` clone experiments and merge reports

## API Contracts (V1 Additions)

Add these endpoints in TS backend:
- `POST /agent/plan` -> return plan + selected tools
- `POST /agent/execute` -> execute plan with safety checks
- `POST /mentor/code/explain`
- `POST /mentor/code/refactor`
- `POST /mentor/code/fix`
- `POST /memory/upsert`
- `GET /memory/profile`
- `GET /audit/recent`

## VS Code Extension V1

Commands:
- `Jarvis: Ask`
- `Jarvis: Explain Selection`
- `Jarvis: Refactor Selection`
- `Jarvis: Fix Selection`

Panels:
- Chat panel (streaming)
- Plan panel (agent reasoning summary)
- Suggestions panel (code mentor output)

State:
- Reuse backend session id.
- Persist extension-specific metadata in root `database/`.

## Safety Rules (Minimum)

- Never execute shell commands without policy approval.
- Restrict file writes to workspace roots.
- Block secret exfiltration patterns.
- Log every tool invocation with timestamp and status.

## Milestone Checklist

### Milestone A
- Agent controller skeleton
- Memory adapters
- Safety policy engine stub

### Milestone B
- Code mentor endpoints
- RAG confidence + citations
- VS Code extension MVP commands

### Milestone C
- Audit logs + weekly progress report
- Domain connector interfaces
- Clone/eval scaffolding

## Definition of Done (V1)

- Existing frontend unchanged and functional.
- Shared root `.env` + root `database/` only.
- Agent can classify intent and return structured plan.
- Code mentoring works on selected snippets.
- RAG answers include source references.
- Safety logs are written for tool actions.
