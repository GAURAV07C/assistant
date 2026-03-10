import * as vscode from 'vscode';
import { getCodeContext, recordRecentEdit, showPatchPreview } from './commands/helpers';
import { registerAstroCommands } from './features/astroCommands';
import { AntiPatternTracker } from './intelligence/antiPatternTracker';
import { BehaviorEngine } from './intelligence/behaviorEngine';
import { MemoryEngine } from './intelligence/memoryEngine';
import { SurpriseEngine } from './intelligence/surpriseEngine';
import { VoiceEngine } from './intelligence/voiceEngine';
import { ChatViewProvider } from './panels/chatViewProvider';
import { JsonViewProvider } from './panels/jsonViewProvider';
import { ErrorLensProvider } from './providers/errorLensProvider';
import { LiveMonitor } from './providers/liveMonitor';
import { registerQuickHoverProvider } from './providers/quickHoverProvider';
import { registerCompletionProviders } from './providers/completionProviders';
import { BackendClient } from './services/backendClient';
import { StyleProfileStore } from './services/styleProfile';

export function activate(context: vscode.ExtensionContext): void {
  const backend = new BackendClient(context);
  const styles = new StyleProfileStore(context);
  const memory = new MemoryEngine(context);
  const antiPatternTracker = new AntiPatternTracker();
  const behaviorEngine = new BehaviorEngine();
  const surpriseEngine = new SurpriseEngine();
  const voiceEngine = new VoiceEngine();

  void memory.initialize();

  const plan = new JsonViewProvider('astroPlanView', 'Plan');
  const suggestions = new JsonViewProvider('astroSuggestionsView', 'Suggestions');
  const chat = new ChatViewProvider(context, backend, memory, voiceEngine, plan, suggestions);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('astroChatView', chat),
    vscode.window.registerWebviewViewProvider('astroPlanView', plan),
    vscode.window.registerWebviewViewProvider('astroSuggestionsView', suggestions),
  );

  registerCompletionProviders(context, backend, styles);
  registerQuickHoverProvider(context);
  new ErrorLensProvider(context).register();
  new LiveMonitor(
    context,
    backend,
    styles,
    suggestions,
    antiPatternTracker,
    behaviorEngine,
    memory,
    surpriseEngine,
    voiceEngine,
  ).register();
  registerAstroCommands(context, backend, plan, suggestions, styles, memory);

  context.subscriptions.push(
    vscode.commands.registerCommand('astro.ask', async () => {
      await chat.focus();
    }),

    vscode.commands.registerCommand('astro.planTask', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'What do you want Astro to plan?',
        placeHolder: 'Example: Refactor this module for better separation of concerns',
      });
      if (!query?.trim()) return;
      await memory.recordTopics(query.trim());
      try {
        const payload = getCodeContext(backend.sessionId);
        const resp = await backend.planTask({
          user_query: query.trim(),
          context: payload || {},
          forced_mode: backend.agentMode,
        });
        plan.setPayload(resp);
        plan.focus();
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro plan failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.explainSelection', async () => {
      const payload = getCodeContext(backend.sessionId);
      if (!payload) return void vscode.window.showWarningMessage('No active editor found.');
      payload.style_profile = styles.get();
      await memory.applyStylePreferences(payload.style_profile);
      try {
        const resp = await backend.explainCode(payload);
        suggestions.setPayload(resp);
        suggestions.focus();
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro explain failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.refactorSelection', async () => {
      const payload = getCodeContext(backend.sessionId);
      if (!payload) return void vscode.window.showWarningMessage('No active editor found.');
      payload.style_profile = styles.get();
      await memory.applyStylePreferences(payload.style_profile);
      try {
        const resp = await backend.refactorCode(payload);
        suggestions.setPayload(resp);
        suggestions.focus();
        if (resp?.suggested_patch) {
          await showPatchPreview('Astro Refactor Suggestion', String(resp.suggested_patch));
        }
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro refactor failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.fixSelection', async () => {
      const payload = getCodeContext(backend.sessionId);
      if (!payload) return void vscode.window.showWarningMessage('No active editor found.');
      payload.style_profile = styles.get();
      await memory.applyStylePreferences(payload.style_profile);
      try {
        const resp = await backend.fixCode(payload);
        suggestions.setPayload(resp);
        suggestions.focus();
        if (resp?.suggested_patch) {
          await showPatchPreview('Astro Fix Suggestion', String(resp.suggested_patch));
        }
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro fix failed: ${String(err?.message || err)}`);
      }
    }),
  );

  const plannerDisposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (doc.isUntitled) return;
    await styles.learnFromDocument(doc);
    await memory.registerImprovementIfFixed(doc.uri.fsPath, doc.getText());

    const prompt = `Summarize a 3-step improvement plan for file: ${doc.uri.fsPath}`;
    const p = await backend.planTask({
      user_query: prompt,
      context: {
        file_path: doc.uri.fsPath,
        language: doc.languageId,
      },
    }).catch(() => null);
    if (p) plan.setPayload(p);
  });

  const openDisposable = vscode.workspace.onDidOpenTextDocument(async (doc) => {
    await styles.learnFromDocument(doc);
    await memory.applyStylePreferences(styles.get());
  });

  const editDisposable = vscode.workspace.onDidChangeTextDocument((evt) => {
    recordRecentEdit(evt.document, evt.contentChanges);
  });

  context.subscriptions.push(plannerDisposable, openDisposable, editDisposable);
}

export function deactivate(): void {}
