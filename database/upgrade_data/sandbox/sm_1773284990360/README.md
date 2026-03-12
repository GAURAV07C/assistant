# J.A.R.V.I.S TypeScript Backend

TypeScript migration of the Python backend with same core API surface.

## Position in Project

- This is the **primary advanced backend** for ASTRO/JARVIS.
- Python backend is treated as legacy/parallel runtime.

## Implemented features
- `/api`, `/health`
- `/chat`, `/chat/stream` (SSE)
- `/chat/realtime`, `/chat/realtime/stream` (SSE + Tavily payload)
- `/chat/history/:session_id`
- `/tts` (MP3 audio response)
- Inline TTS audio chunks in SSE when `tts: true`
- Session persistence in `database/chats_data`
- Groq multi-key primary-first fallback
- Provider fallback chain: Groq -> OpenRouter -> Gemini
- Realtime Tavily search integration
- Frontend static serving on `/app`

## Notes
- Inline/standalone TTS uses the Node package `edge-tts` (no Python backend dependency).
- DB path defaults to shared root `../database` (same as Python backend), so both backends use the same stored data.

## Setup
1. Use root env:
   - `/data/data/com.termux/files/home/downloads/assistant/.env`
2. Install deps:
   - `npm install`
3. Run dev:
   - `npm run dev`

Default port: `8000`
