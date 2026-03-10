# Layer Status (Current Build)

## Summary
Phase 1 ke liye major layered architecture implement ho chuka hai.

- Total logical layers tracked: 14
- Fully implemented: 12
- Partially implemented: 2
- Not in Phase 1 scope: autonomous/multi-device/cloud-sync layers

---

## A) Backend Guardrail + Dual-Brain Layers

### 1) Input Filter Layer
Status: Implemented
- Prompt injection detection
- Malicious/unsafe pattern detection
- Query classification: `normal | research | risky`
- Risk scoring: `0-100`

File:
- `ts-backend/src/guardrails/input_filter.ts`

### 2) Policy Engine Layer
Status: Implemented
- `normal -> Brain A`
- `research -> Brain B`
- `risky -> educational safe mode`

File:
- `ts-backend/src/guardrails/policy_engine.ts`

### 3) Brain Router Layer
Status: Implemented
- Brain A primary route
- Brain B research route
- Brain A fail/refusal fallback to Brain B
- Uses policy decision + mode hints

File:
- `ts-backend/src/core/agent/brain_router.ts`

### 4) Brain A Layer (Primary LLM)
Status: Implemented
- Standard LLM response path
- Extension-mode response path

File:
- `ts-backend/src/core/agent/brain_a_llm.ts`

### 5) Brain B Layer (Research/Reasoning)
Status: Implemented
- Deep reasoning prompt path
- Realtime/research-backed path where available

File:
- `ts-backend/src/core/agent/brain_b_reasoning.ts`

### 6) Output Filter Layer
Status: Implemented
- Unsafe output pattern sanitization
- Educational safe fallback response

File:
- `ts-backend/src/guardrails/output_filter.ts`

### 7) Router Logging Layer
Status: Implemented
- Per-query routing logs
- Route summary support
- Recent log read support

File:
- `ts-backend/src/core/safety/router_logs.ts`

### 8) Chat Pipeline Integration Layer
Status: Implemented
- ChatService routes through guardrail + dual-brain path
- General/realtime/extension chat flows wired

File:
- `ts-backend/src/services/chatService.ts`

---

## B) VS Code Extension Intelligence Layers

### 9) Persistent Developer Memory Layer
Status: Implemented
- `developerProfile.json` creation + load
- Skills/topic frequency tracking
- Anti-pattern counters
- Style preference persistence
- Improvement score increment heuristic

File:
- `vscode-Astro-extension/src/intelligence/memoryEngine.ts`

### 10) Intent Router Layer
Status: Implemented
- User input intent classification
- Confidence-based fallback to normal chat
- Routed chat handling integrated

Files:
- `vscode-Astro-extension/src/intelligence/intentRouter.ts`
- `vscode-Astro-extension/src/services/backendClient.ts`

### 11) Anti-Pattern Tracking Layer
Status: Implemented
- Detects repeated risky coding patterns
- Advisory trigger on repeated occurrences
- Frequency control to reduce spam

File:
- `vscode-Astro-extension/src/intelligence/antiPatternTracker.ts`

### 12) Adaptive Behavior Layer
Status: Implemented
- Modes: `soft | mentor | brutal`
- Finding filtering by mode
- Complexity pressure behavior in brutal mode

File:
- `vscode-Astro-extension/src/intelligence/behaviorEngine.ts`

### 13) Flow Protection Layer
Status: Implemented
- Rapid typing streak detection
- Suggestion defer logic
- Effective debounce floor: ~2500ms

File:
- `vscode-Astro-extension/src/providers/liveMonitor.ts`

### 14) Surprise Question Layer
Status: Implemented
- Contextual surprise coaching prompts
- Rate limit: max 3 / 10 minutes

File:
- `vscode-Astro-extension/src/intelligence/surpriseEngine.ts`

### 15) Voice Feedback Layer (UI-driven)
Status: Implemented
- Optional voice toggle via setting
- Critical issue alerts only
- Cooldown control (~20s)
- Voice played from webview UI using speech synthesis

Files:
- `vscode-Astro-extension/src/intelligence/voiceEngine.ts`
- `vscode-Astro-extension/src/panels/chatViewProvider.ts`

### 16) Context Awareness Layer
Status: Partially Implemented
- Active file + selection + full file content
- Recent edits tracking
- Git staged diff (file scoped)

Files:
- `vscode-Astro-extension/src/commands/helpers.ts`
- `vscode-Astro-extension/src/extension.ts`

### 17) Stability Layer (Extension client-side)
Status: Partially Implemented
- Request queue
- Throttling / minimal rate limiting
- Timeout wrapper
- Fallback to standard stream route

File:
- `vscode-Astro-extension/src/services/backendClient.ts`

---

## Current Effective Response Flow (Backend)
User Query
-> Input Filter
-> Policy Engine
-> Brain Router
-> Brain A or Brain B
-> Output Filter
-> Response
-> Router Log

---

## Out of Scope (Phase 1)
- Autonomous multi-step self-driving agent mode
- Cloud sync / multi-device identity memory
- Self-modifying runtime

