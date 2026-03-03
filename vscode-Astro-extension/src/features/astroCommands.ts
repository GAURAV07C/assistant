import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getCodeContext } from '../commands/helpers';
import { JsonViewProvider } from '../panels/jsonViewProvider';
import { BackendClient } from '../services/backendClient';
import { StyleProfileStore } from '../services/styleProfile';

const execFileAsync = promisify(execFile);
const inlineOutputDecoration = vscode.window.createTextEditorDecorationType({
  after: {
    color: new vscode.ThemeColor('editorCodeLens.foreground'),
    margin: '0 0 0 14px',
  },
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

function activeEditorContext(backend: BackendClient, styles: StyleProfileStore) {
  const payload = getCodeContext(backend.sessionId);
  if (!payload) return undefined;
  payload.style_profile = styles.get();
  return payload;
}

async function runAnalyzeMode(
  backend: BackendClient,
  styles: StyleProfileStore,
  suggestions: JsonViewProvider,
  mode: string,
  title: string,
): Promise<void> {
  const payload = activeEditorContext(backend, styles);
  if (!payload) return void vscode.window.showWarningMessage('No active editor found.');
  const resp = await backend.analyzeCode(mode, payload);
  suggestions.setPayload(resp);
  suggestions.focus();
  if (mode === 'output_preview' && resp.predicted_output) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const line = editor.selection.active.line;
      const range = new vscode.Range(line, editor.document.lineAt(line).range.end.character, line, editor.document.lineAt(line).range.end.character);
      editor.setDecorations(inlineOutputDecoration, [{
        range,
        renderOptions: {
          after: {
            contentText: ` Output: ${String(resp.predicted_output).replace(/\s+/g, ' ').slice(0, 180)}`,
          },
        },
      }]);
    }
  }
  void vscode.window.showInformationMessage(`${title} completed.`);
}

export function registerAstroCommands(
  context: vscode.ExtensionContext,
  backend: BackendClient,
  plan: JsonViewProvider,
  suggestions: JsonViewProvider,
  styles: StyleProfileStore,
): void {
  context.subscriptions.push(
    inlineOutputDecoration,
    vscode.commands.registerCommand('astro.outputPreview', async () => {
      try {
        await runAnalyzeMode(backend, styles, suggestions, 'output_preview', 'Output preview');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro output preview failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.securityScan', async () => {
      try {
        await runAnalyzeMode(backend, styles, suggestions, 'security', 'Security analysis');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro security scan failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.performanceScan', async () => {
      try {
        await runAnalyzeMode(backend, styles, suggestions, 'performance', 'Performance analysis');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro performance scan failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.generateDocs', async () => {
      try {
        await runAnalyzeMode(backend, styles, suggestions, 'docs', 'Documentation generation');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro docs generation failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.apiDbAssist', async () => {
      try {
        await runAnalyzeMode(backend, styles, suggestions, 'api_db', 'API & DB assistant');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro API/DB assist failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.detectBugs', async () => {
      try {
        await runAnalyzeMode(backend, styles, suggestions, 'bug', 'Bug detection');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro bug detection failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.generateSnippet', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return void vscode.window.showWarningMessage('No active editor found.');

      const request = await vscode.window.showInputBox({
        prompt: 'Snippet requirement',
        placeHolder: 'Example: async retry helper with exponential backoff',
      });
      if (!request?.trim()) return;

      try {
        const resp = await backend.generateSnippet({
          request: request.trim(),
          language: editor.document.languageId,
          style_profile: styles.get(),
        });

        const body = Array.isArray(resp.body) && resp.body.length > 0
          ? resp.body.join('\n')
          : resp.raw;

        const ok = await vscode.window.showInformationMessage('Insert generated snippet at cursor?', 'Insert', 'Cancel');
        if (ok !== 'Insert') return;

        await editor.edit((eb) => eb.insert(editor.selection.active, body));
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro snippet generation failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.gitAutomation', async () => {
      try {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) return void vscode.window.showWarningMessage('Open a workspace folder first.');

        const { stdout: staged } = await execFileAsync('git', ['diff', '--staged'], { cwd, maxBuffer: 1024 * 1024 });
        if (!staged.trim()) {
          void vscode.window.showWarningMessage('No staged changes found. Stage files first, then run Astro Git Automation.');
          return;
        }

        const resp = await backend.suggestCommitMessage(staged);
        const selected = await vscode.window.showInformationMessage(`Suggested commit:\n${resp.message}`, 'Commit', 'Cancel');
        if (selected !== 'Commit') return;

        const [header, ...rest] = resp.message.split('\n\n');
        const args = ['commit', '-m', header];
        if (rest.length > 0) args.push('-m', rest.join('\n\n'));
        await execFileAsync('git', args, { cwd, maxBuffer: 1024 * 1024 });
        void vscode.window.showInformationMessage('Commit created successfully.');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro git automation failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.agentModeFuture', async () => {
      const payload = {
        status: 'planned',
        feature: 'Agent mode',
        details: 'Multi-step autonomous plan -> execute -> validate loop will be added in next milestone.',
      };
      plan.setPayload(payload);
      plan.focus();
    }),

    vscode.commands.registerCommand('astro.multiFileFuture', async () => {
      const payload = {
        status: 'planned',
        feature: 'Multi-file automation',
        details: 'Cross-file context planner and safe patch queue are reserved for future milestone.',
      };
      plan.setPayload(payload);
      plan.focus();
    }),
  );
}
