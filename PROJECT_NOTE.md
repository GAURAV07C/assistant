# Project Note (Detailed)

Yeh project ek AI assistant stack hai jisme Python backend ka TypeScript migration bhi availab le hai.  
Current target yeh hai ki existing frontend bina badle chale aur data same root `database/` me store ho.

## 1. High-Level Architecture

### Frontend
- Location: `frontend/`
- Existing vanilla HTML/CSS/JS UI use hoti hai.
- Frontend ko change kiye bina run karne ke liye TS backend same API contract follow karta hai.

### Backends
- Python backend: original implementation
- TypeScript backend: `ts-backend/` me migrated implementation

### Shared Storage
- Root database path: `database/`
- Learning data: `database/learning_data/*.txt`
- Chat persistence: `database/chats_data/*.json`
- TS backend ko configure kiya gaya hai ki same root database use kare.

## 2. TypeScript Backend (What Is Implemented)

Location: `ts-backend/src/`

### Core Files
- `server.ts`: Express app, endpoints, SSE streaming, static frontend serving
- `config.ts`: env loading, shared DB paths, runtime constants
- `models/schemas.ts`: request validation (Zod)
- `types/chat.ts`: chat/search payload types

### Services
- `services/chatService.ts`
  - session create/load/save
  - history formatting
  - blocking + streaming chat flows
- `services/groqService.ts`
  - Groq model invocation
  - multi-key fallback strategy
  - prompt assembly with context + time
- `services/realtimeService.ts`
  - Tavily-based realtime web search integration
  - extracted search payload streaming support
- `services/vectorStore.ts`
  - learning/chat data loading
  - chunking + retrieval logic
- `services/ttsService.ts`
  - Node `edge-tts` based TTS generation (no Python dependency)

### Utilities
- `utils/retry.ts`: retry with exponential backoff
- `utils/timeInfo.ts`: time context formatter

## 3. API Surface (TS Backend)

Implemented endpoints:
- `GET /health`
- `GET /api`
- `POST /chat`
- `POST /chat/stream` (SSE)
- `POST /chat/realtime`
- `POST /chat/realtime/stream` (SSE + search payload)
- `GET /chat/history/:session_id`
- `POST /tts` (audio response)
- `GET /app/*` (frontend static serve)

## 4. Environment and Path Behavior

### Env Source
- Primary env file: root `.env` (`/assistant/.env`)
- TS backend local `.env` ko active flow me use nahi karta by default.

### Database Source
- Primary DB path: root `database/`
- Isliye Python aur TS dono same data dekh sakte hain.

### Port
- Default TS port: `8000` (frontend compatibility ke liye)
- Optional override: `PORT` env variable

## 5. Current Run Steps (TS)

From `ts-backend/`:
1. `npm install`
2. `npm run dev`

Production style:
1. `npm run build`
2. `npm start`

Health check:
- `http://localhost:8000/health`

Frontend:
- `http://localhost:8000/app/`

## 6. Known Runtime Dependency Notes

- Chat pipeline ke liye valid Groq key zaruri hai.
- Agar wrong provider key use hogi (example: non-Groq prefix), to chat call fail ho sakti hai.
- TTS upstream service restrictions (network/provider side) ke case me `/tts` failure aa sakta hai.

## 7. Current Project State Summary

- TS migration foundation complete hai.
- Frontend compatibility maintain ki gayi hai.
- Shared root storage enforce kiya gaya hai.
- Cleanup pass me unnecessary TS-side local database/scripting leftovers remove kiye gaye hain.

---

Last updated: local development session.
