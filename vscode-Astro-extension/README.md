# Astro Mentor VS Code Extension (V1)

## Features
- Chat panel with streaming responses from Astro backend.
- Commands:
  - `Astro: Ask`
  - `Astro: Explain Selection`
  - `Astro: Refactor Selection`
  - `Astro: Fix Selection`
- Plan panel and Suggestions panel.
- Uses backend session-id for multi-turn continuity.

## Backend Requirements
Run TS backend first at `http://localhost:8000` (or set `astro.backendUrl` in VS Code settings).

Required endpoints available:
- `/chat/stream`
- `/agent/plan`
- `/mentor/code/explain`
- `/mentor/code/refactor`
- `/mentor/code/fix`

## Build
```bash
cd vscode-Astro-extension
npm install
npm run build
```

## Run in VS Code
1. Open `vscode-Astro-extension` folder in VS Code.
2. Press `F5` (Launch Extension Development Host).
3. In new window, open Command Palette and run `Astro: Ask`.

## Safety Defaults
- No auto-write to workspace files.
- Refactor/fix opens preview patch instead of direct apply.
