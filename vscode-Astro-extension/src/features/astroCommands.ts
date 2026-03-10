import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getCodeContext } from '../commands/helpers';
import { MemoryEngine } from '../intelligence/memoryEngine';
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
  memory: MemoryEngine,
): void {
  context.subscriptions.push(
    inlineOutputDecoration,
    vscode.commands.registerCommand('astro.quickActions', async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: 'Explain Selection', command: 'astro.explainSelection' },
          { label: 'Refactor Selection', command: 'astro.refactorSelection' },
          { label: 'Fix Selection', command: 'astro.fixSelection' },
          { label: 'Bug Detection', command: 'astro.detectBugs' },
          { label: 'Inline Output Preview', command: 'astro.outputPreview' },
          { label: 'Agent Execute Task', command: 'astro.agentExecuteTask' },
          { label: 'Switch Strategic Mode', command: 'astro.switchStrategicMode' },
          { label: 'Switch Casual Mode', command: 'astro.switchCasualMode' },
          { label: 'Open Evolution Dashboard', command: 'astro.openEvolutionDashboard' },
          { label: 'Ask Astro', command: 'astro.ask' },
        ],
        { placeHolder: 'Astro quick actions' },
      );
      if (!pick) return;
      await vscode.commands.executeCommand(pick.command);
    }),

    vscode.commands.registerCommand('astro.switchStrategicMode', async () => {
      await backend.setAgentMode('strategic');
      void vscode.window.showInformationMessage('Astro mode switched: strategic');
    }),

    vscode.commands.registerCommand('astro.switchCasualMode', async () => {
      await backend.setAgentMode('casual');
      void vscode.window.showInformationMessage('Astro mode switched: casual');
    }),

    vscode.commands.registerCommand('astro.openEvolutionDashboard', async () => {
      try {
        const [evolution, curriculum, reflection] = await Promise.all([
          backend.getEvolutionStatus(),
          backend.getCurriculumNext(),
          backend.getReflectionRecent(20),
        ]);

        plan.setPayload({
          status: 'ok',
          feature: 'Evolution Dashboard',
          evolution_summary: evolution?.evaluation_summary || null,
          next_task: curriculum?.next_task || null,
          suggested_resources: curriculum?.suggested_resources || [],
          agents: evolution?.agents || [],
        });
        suggestions.setPayload({
          status: 'ok',
          curriculum,
          reflections: reflection?.reviews || [],
          skills: evolution?.skills || null,
        });
        plan.focus();
        suggestions.focus();
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro evolution dashboard failed: ${String(err?.message || err)}`);
      }
    }),

    vscode.commands.registerCommand('astro.agentExecuteTask', async () => {
      const instruction = await vscode.window.showInputBox({
        prompt: 'Agent instruction',
        placeHolder: 'Example: analyze this module and propose safe refactor plan',
      });
      if (!instruction?.trim()) return;
      await memory.recordTopics(instruction);

      const payload = activeEditorContext(backend, styles);
      try {
        let resp = await backend.executeTask({
          instruction: instruction.trim(),
          context: payload || {},
          forced_mode: backend.agentMode,
          confirm: false,
        });

        if (resp?.needs_confirmation || resp?.status === 'clarification_required') {
          const confirm = await vscode.window.showWarningMessage(
            resp?.detail || resp?.clarification_question || 'Agent needs confirmation/clarification.',
            'Confirm and Continue',
            'Cancel',
          );

          if (confirm === 'Confirm and Continue') {
            resp = await backend.executeTask({
              instruction: instruction.trim(),
              context: payload || {},
              forced_mode: backend.agentMode,
              confirm: true,
            });
          }
        }

        plan.setPayload(resp);
        plan.focus();
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Astro agent execute failed: ${String(err?.message || err)}`);
      }
    }),

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
      await memory.recordTopics(request);

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
        status: 'available',
        feature: 'Agent mode',
        details: 'Agent planner and execute flow are now wired via /agent/plan and /agent/execute.',
        active_mode: backend.agentMode,
      };
      plan.setPayload(payload);
      plan.focus();
    }),

    vscode.commands.registerCommand('astro.multiFileFuture', async () => {
      const payload = {
        status: 'planned',
        feature: 'Multi-file automation',
        details: 'Cross-file orchestration pending; safety confirmation model is already integrated in agent execute flow.',
      };
      plan.setPayload(payload);
      plan.focus();
    }),
  );
}
