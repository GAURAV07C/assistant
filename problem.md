# ASTRO / JARVIS Chat System (Backend) - Problem & Design Notes

## Goal
Backend khud decide kare:
- user message ka intent kya hai
- casual ya strategic mode kab use karna hai
- clarification kab maangni hai
- response ka tone/format kaisa rakhna hai

Target behavior: assistant natural lage, over-formal template response na de.

## Current Chat Flow
Message flow (`/chat`, `/chat/realtime`, `/chat/stream`, `/chat/realtime/stream`):

1. User message API pe aata hai.
2. `adaptForAgent()` internal contract banata hai:
   - `intent`
   - `complexity_score`
   - `ambiguity_score`
   - `selected_mode`
3. Clarification gate:
   - agar required ho to direct clarification response return hota hai.
   - warna `mapMessageForMode(...)` prompt banata hai.
4. Personalization layer (`applyPersonalStyle`) profile hints apply karti hai.
5. ChatService LLM call karta hai (normal/realtime/stream).
6. Audit log + session persistence.

## Key Files
- `ts-backend/src/server.ts`
  - `adaptForAgent(...)`
  - `/chat*` and `/extension/chat*` routes
- `ts-backend/src/core/agent/controller.ts`
  - `classifyIntent(...)`
  - `scoreComplexity(...)`
  - `scoreAmbiguity(...)`
  - `selectMode(...)`
  - `needsClarification(...)`
  - `clarificationQuestion(...)`
  - `mapMessageForMode(...)`

## Auto Decision System
Agent controller auto-decision rules:

- Intent classification:
  - coding / debugging / planning / git / memory_update / documentation / system_action / learning / casual_conversation

- Complexity scoring:
  - word count + technical pattern signals + multi-step signals

- Ambiguity scoring:
  - vague markers + short text + missing directive/domain markers

- Mode switching:
  - high complexity/ambiguity => strategic
  - casual/small-talk => casual
  - forced mode supported (when explicitly requested)

- Clarification trigger:
  - only when ambiguity threshold cross kare and intent casual na ho

## Small-Talk Fix (Implemented)
Issue: `Hlo` jaise messages pe formal structured response aa raha tha.

Root cause:
- short greeting ko high ambiguity treat karke strategic/clarification path hit ho raha tha.

Fixes done:
- `isSmallTalk(...)` detector add:
  - `hi`, `hello`, `hlo`, `ok`, `thanks`, `how are you`, `haan` etc.
- Small-talk ke liye:
  - intent => `casual_conversation`
  - ambiguity => low
  - mode => `casual`
  - clarification => disabled
- Prompt style update:
  - structured headings (`Problem Framing`, `Ambiguity`, `Clarification`) avoid
  - strategic mode me bhi direct assistant-style answer first

## Response Style Engine (Current)
`mapMessageForMode(...)` now:

- Small-talk:
  - 1-2 line natural human response
  - no report template

- Strategic:
  - auto depth selection
  - direct answer first, then needed steps
  - clarification only if critical data missing

- Casual:
  - concise, natural, non-formal tone

## Endpoint Behavior Summary
- `/chat`:
  - non-streaming general chat
- `/chat/realtime`:
  - non-streaming realtime path
- `/chat/stream`:
  - SSE streaming + optional inline TTS
- `/chat/realtime/stream`:
  - realtime SSE + optional inline TTS
- `/extension/chat/*`:
  - extension-focused coding chat stream paths

## Example Scenarios

### Scenario 1: Greeting
Input: `Hlo`
- intent => casual_conversation
- mode => casual
- clarification => false
- output => short normal assistant reply

### Scenario 2: Technical task
Input: `Refactor auth middleware and add error handling`
- intent => coding/debugging
- mode => strategic
- clarification => depends on ambiguity/context
- output => direct actionable response with minimal necessary structure

### Scenario 3: Ambiguous execution request
Input: `Ye implement kar do`
- intent => coding/system_action
- ambiguity high
- clarification => true (targeted follow-up)

## Known Constraints
- Over-aggressive clarification still possible on very vague non-casual tasks (expected by design for safety).
- Real tool execution still policy/safety checks ke under hota hai.
- Response quality depends on upstream model + prompt quality + memory profile.

## Suggested Next Improvements
1. Intent confidence score add karke low-confidence pe softer clarification.
2. Per-user response style memory ko stronger weight dena (tone/depth).
3. Clarification templates per intent + per language (Hinglish/English auto).
4. Small-talk detector ko multilingual slang set se expand karna.
5. Router stats me `small_talk_bypass` metric track karna.

## UI Integration (Synced)

### React UI Flow
- Main UI: `react-assistant-ui/src/components/AstroDashboard.tsx`
- Chat tab send path:
  - general -> `/chat/stream`
  - realtime -> `/chat/realtime/stream`
- Agent actions:
  - plan -> `/agent/plan`
  - execute -> `/agent/execute`
- Stream handling:
  - `chunk` text append in transcript
  - `citations` + `confidence` metadata display-ready
  - `audio` chunks go to local `TTSPlayer`
  - `done` marks stream completion

### React UI Modules
- Layout shell/header:
  - `react-assistant-ui/src/components/dashboard/DashboardShell.tsx`
  - `react-assistant-ui/src/components/dashboard/DashboardHeader.tsx`
- Tab modules:
  - `OverviewTab.tsx`, `ChatTab.tsx`, `AgentTab.tsx`, `SkillsTab.tsx`, `FilesTab.tsx`, `VoiceTab.tsx`, `LogsTab.tsx`
  - path: `react-assistant-ui/src/components/dashboard/tabs/`

### TTS Runtime Note
- File: `react-assistant-ui/src/lib/ttsPlayer.js`
- Next SSR-safe guards added (`Audio/window` checks) to avoid `Audio is not defined` runtime error.

### VS Code Extension Alignment
- Extension chat routes:
  - `/extension/chat/stream`
  - `/extension/chat/realtime/stream`
- Key files:
  - `vscode-Astro-extension/src/services/backendClient.ts`
  - `vscode-Astro-extension/src/panels/chatViewProvider.ts`

### Run Commands
- Full stack: `npm run dev`
- UI only: `npm run dev:ui`
- Backend only: `npm run dev:backend`

### Debugging Checklist (Chat odd response case)
1. Confirm message route (`/chat*` vs `/extension/chat*`).
2. Check `adaptForAgent()` output in backend logs/response payload.
3. Verify `intent`, `ambiguity_score`, `selected_mode` in contract.
4. Verify small-talk detection path for greeting-like input.
5. Check UI mode toggles (`general/realtime`, `casual/strategic`) are expected.
