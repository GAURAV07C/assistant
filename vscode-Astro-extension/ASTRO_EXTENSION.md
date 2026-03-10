# Astro Extension Guide

## Overview
Astro is a VS Code/code-server extension for AI chat, mentoring, refactoring, diagnostics, and live code monitoring.

## Core Features Implemented
- Real agent-core integration (`/agent/plan`, `/agent/execute`)
- Adaptive agent modes: `casual` and `strategic`
- Clarification-first behavior on ambiguous tasks
- Codex-style chat panel with multi-turn context
- AI autocomplete
  - Inline ghost text
  - Completion dropdown suggestions
- Inline errors
  - Native diagnostics from Astro live monitor
  - Error Lens-style inline display
- Inline output preview
  - Command: `Astro: Inline Output Preview`
  - Predicted output shown inline beside current code line
- Pointer-near quick actions
  - Hover on code to get Astro action links (Explain/Refactor/Fix/Bug/Output)
  - Command: `Astro: Quick Actions`
- Refactoring and bug fixing suggestions
- Bug detection command
- Snippet generation and insert
- Git automation (staged diff -> suggested commit -> optional commit)
- API & DB assistant
- Security analysis
- Performance optimization analysis
- Documentation generation
- Adaptive style learning (indent/semicolon/quotes)
- Future placeholders
  - Agent mode
  - Multi-file automation

## Live Monitoring
Astro monitors supported files while you type:
- Languages: JavaScript, TypeScript, Python (+ React TS/JS variants)
- Debounced analysis to reduce noise
- Diagnostics are added to VS Code Problems
- Status bar toggle: `Astro Monitor: ON/OFF`

### Live Monitor Settings
- `astro.liveMonitorEnabled` (default: `true`)
- `astro.liveMonitorDebounceMs` (default: `1500`)
- `astro.liveMonitorAutoOpenSuggestions` (default: `false`)

## Commands
- `Astro: Ask`
- `Astro: Plan Task`
- `Astro: Agent Execute Task`
- `Astro: Switch Strategic Mode`
- `Astro: Switch Casual Mode`
- `Astro: Explain Selection`
- `Astro: Refactor Selection`
- `Astro: Fix Selection`
- `Astro: Bug Detection`
- `Astro: Quick Actions`
- `Astro: Inline Output Preview`
- `Astro: Generate Snippet`
- `Astro: Git Automation`
- `Astro: API & DB Assistant`
- `Astro: Security Analysis`
- `Astro: Performance Optimization`
- `Astro: Generate Documentation`
- `Astro: Toggle Live Monitor`
- `Astro: Agent Mode (Future)`
- `Astro: Multi-file Automation (Future)`

## Backend Endpoints Used
- `/chat/stream`
- `/agent/plan`
- `/mentor/code/explain`
- `/mentor/code/refactor`
- `/mentor/code/fix`
- `/mentor/code/complete`
- `/mentor/code/analyze`
- `/mentor/snippet/generate`
- `/mentor/git/commit-message`

## Run / Install
1. Build extension:
   ```bash
   cd vscode-Astro-extension
   npm run build
   npx @vscode/vsce package
   ```
2. Install in code-server:
   ```bash
   code-server --install-extension astro-mentor-extension-0.0.1.vsix --force
   ```
3. Reload:
   - Command Palette -> `Developer: Reload Window`

## Troubleshooting
- Command appears but nothing happens:
  - Run `Developer: Reload Window`
  - Reinstall VSIX with `--force`
- Chat opens but no response:
  - Check backend URL: `astro.backendUrl`
  - Check backend health: `curl http://127.0.0.1:8000/health`
- Live monitor not triggering:
  - Ensure `astro.liveMonitorEnabled=true`
  - Use supported language files

## Codex-Style Agent Console (New)
- Chat panel upgraded to `Astro Agent Console` layout.
- Added direct `Plan` and `Execute` actions from the chat composer.
- Added structured reasoning inspector panel with:
  - Summary
  - Plan
  - Internal Contract
  - Evaluation
  - Steps / Trace
- Added agent confirmation flow for execute actions requiring confirmation.
- Added clear/reset action in chat panel.
