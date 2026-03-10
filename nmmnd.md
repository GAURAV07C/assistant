# Recent Updates (TS + UI)

Date: 2026-03-09

## 1) Personal Memory + Recall Upgrades (TS Backend)

### Implemented
- Auto personal fact extraction from user messages:
  - name, location, preference, goal, role patterns
- High-priority memory recall injection in chat prompts
  - applied across general, realtime, extension streaming flows
- Memory recall debug API added:
  - `POST /memory/recall-debug`
  - input: `{ "message": "..." }`
  - output: injected facts, sources, extracted fact preview

### Files
- `ts-backend/src/core/memory/memoryService.ts`
- `ts-backend/src/services/chatService.ts`
- `ts-backend/src/server.ts`

## 2) Vector Memory Refresh Improvement

### Implemented
- Vector store now auto-refreshes when learning/chat files change
- Uses file fingerprinting to detect updates and rebuild chunks

### File
- `ts-backend/src/services/vectorStore.ts`

## 3) Dashboard + Runtime Controls (React UI)

### Implemented
- All non-chat sections use accordion and default closed
- System Log moved into accordion
- Settings now supports dynamic multi-key Groq API management from UI
- WebSocket runtime key update support integrated

### Files
- `react-assistant-ui/src/components/ai-os-v3/AIOSDashboardShell.tsx`
- `react-assistant-ui/src/lib/useAIOSWebSocket.ts`
- `ts-backend/src/server.ts`
- `ts-backend/src/services/runtimeKeyStore.ts`
- `ts-backend/src/services/groqService.ts`
- `ts-backend/src/services/realtimeService.ts`

## 4) NEW: Dashboard Recall Debug Panel

### Implemented
- Memory section now includes "Recall Debug" panel
- You can type a query and see exactly what memory would be injected
- Uses backend endpoint `/memory/recall-debug`

### Files
- `react-assistant-ui/src/components/ai-os-v3/AIOSDashboardShell.tsx`
- `react-assistant-ui/src/lib/useAIOSWebSocket.ts`

## 5) Validation

- TS backend typecheck: passed
- Next.js UI build: previously passed after websocket/dashboard upgrades

