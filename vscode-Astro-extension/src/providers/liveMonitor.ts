import * as vscode from 'vscode';
import { JsonViewProvider } from '../panels/jsonViewProvider';
import { BackendClient, type CodeContextPayload } from '../services/backendClient';
import { StyleProfileStore } from '../services/styleProfile';
import { AntiPatternTracker } from '../intelligence/antiPatternTracker';
import { BehaviorEngine } from '../intelligence/behaviorEngine';
import { MemoryEngine } from '../intelligence/memoryEngine';
import { SurpriseEngine } from '../intelligence/surpriseEngine';
import { VoiceEngine } from '../intelligence/voiceEngine';

const SUPPORTED = new Set(['javascript', 'typescript', 'python', 'javascriptreact', 'typescriptreact']);

function toSeverity(value: string | undefined): vscode.DiagnosticSeverity {
  const text = String(value || '').toLowerCase();
  if (text.includes('high') || text.includes('critical') || text.includes('error')) return vscode.DiagnosticSeverity.Error;
  if (text.includes('medium') || text.includes('warning') || text.includes('warn')) return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
}

function clampLine(doc: vscode.TextDocument, oneBased?: number): number {
  if (!oneBased || Number.isNaN(oneBased)) return 0;
  const idx = Math.max(0, Math.min(doc.lineCount - 1, oneBased - 1));
  return idx;
}

function toPayload(doc: vscode.TextDocument, backend: BackendClient, styles: StyleProfileStore): CodeContextPayload {
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  return {
    language: doc.languageId,
    file_path: doc.uri.fsPath,
    selection: '',
    file_content: doc.getText(),
    workspace_root: folder?.uri.fsPath || '',
    session_id: backend.sessionId,
    style_profile: styles.get(),
  };
}

export class LiveMonitor {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('astro-ai');
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlight = new Set<string>();
  private readonly status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  private readonly burstState = new Map<string, { lastChangeAt: number; streak: number; hotUntil: number }>();

  constructor(
    private context: vscode.ExtensionContext,
    private backend: BackendClient,
    private styles: StyleProfileStore,
    private suggestions: JsonViewProvider,
    private antiPatternTracker: AntiPatternTracker,
    private behaviorEngine: BehaviorEngine,
    private memoryEngine: MemoryEngine,
    private surpriseEngine: SurpriseEngine,
    private voiceEngine: VoiceEngine,
  ) {}

  register(): void {
    this.status.command = 'astro.toggleLiveMonitor';
    this.updateStatus();
    this.status.show();

    this.context.subscriptions.push(
      this.diagnostics,
      this.status,
      vscode.workspace.onDidChangeTextDocument((e) => this.onChangeEvent(e)),
      vscode.workspace.onDidOpenTextDocument((doc) => this.onOpen(doc)),
      vscode.workspace.onDidCloseTextDocument((doc) => this.onClose(doc)),
      vscode.commands.registerCommand('astro.toggleLiveMonitor', async () => {
        const cfg = vscode.workspace.getConfiguration();
        const current = Boolean(cfg.get('astro.liveMonitorEnabled', true));
        await cfg.update('astro.liveMonitorEnabled', !current, vscode.ConfigurationTarget.Global);
        this.updateStatus();
        if (!current) {
          const editor = vscode.window.activeTextEditor;
          if (editor) this.schedule(editor.document);
        } else {
          this.clearAllTimers();
          this.diagnostics.clear();
        }
      }),
    );
  }

  private isEnabled(): boolean {
    const cfg = vscode.workspace.getConfiguration();
    return Boolean(cfg.get('astro.liveMonitorEnabled', true));
  }

  private debounceMs(): number {
    const cfg = vscode.workspace.getConfiguration();
    const configured = Math.max(400, Number(cfg.get('astro.liveMonitorDebounceMs', 1500)) || 1500);
    return Math.max(configured, 2500);
  }

  private autoOpenSuggestions(): boolean {
    const cfg = vscode.workspace.getConfiguration();
    return Boolean(cfg.get('astro.liveMonitorAutoOpenSuggestions', false));
  }

  private updateStatus(): void {
    this.status.text = this.isEnabled() ? '$(pulse) Astro Monitor: ON' : '$(circle-slash) Astro Monitor: OFF';
    this.status.tooltip = 'Toggle Astro live monitoring';
  }

  private onOpen(doc: vscode.TextDocument): void {
    if (!this.isEnabled()) return;
    if (!SUPPORTED.has(doc.languageId)) return;
    if (doc.isUntitled) return;
    if (doc.getText().length > 120_000) return;
    this.schedule(doc);
  }

  private onChangeEvent(evt: vscode.TextDocumentChangeEvent): void {
    const doc = evt.document;
    if (!this.isEnabled()) return;
    if (!SUPPORTED.has(doc.languageId)) return;
    if (doc.isUntitled) return;
    if (doc.getText().length > 120_000) return;

    const key = doc.uri.toString();
    const now = Date.now();
    const prev = this.burstState.get(key) || { lastChangeAt: 0, streak: 0, hotUntil: 0 };
    const delta = now - prev.lastChangeAt;
    const streak = delta <= 420 ? prev.streak + 1 : 1;
    const hotUntil = streak >= 4 ? now + this.debounceMs() : Math.max(prev.hotUntil, now + 200);
    this.burstState.set(key, { lastChangeAt: now, streak, hotUntil });

    this.schedule(doc);
  }

  private onClose(doc: vscode.TextDocument): void {
    const key = doc.uri.toString();
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
    this.inFlight.delete(key);
    this.burstState.delete(key);
    this.diagnostics.delete(doc.uri);
  }

  private schedule(doc: vscode.TextDocument): void {
    const key = doc.uri.toString();
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    const burst = this.burstState.get(key);
    const extraWait = burst ? Math.max(0, burst.hotUntil - Date.now()) : 0;
    const waitMs = Math.max(this.debounceMs(), extraWait);

    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.run(doc);
    }, waitMs);

    this.timers.set(key, timer);
  }

  private clearAllTimers(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private async run(doc: vscode.TextDocument): Promise<void> {
    const key = doc.uri.toString();
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);

    try {
      await this.styles.learnFromDocument(doc);
      await this.memoryEngine.applyStylePreferences(this.styles.get());
      await this.memoryEngine.recordTopics(doc.getText().slice(0, 3000));

      const payload = toPayload(doc, this.backend, this.styles);
      const result = await this.backend.analyzeCode('bug', payload);

      const rawFindings = Array.isArray(result.findings) ? result.findings : [];
      const findings = this.behaviorEngine.selectFindings(rawFindings);
      const diagnostics = findings.slice(0, 50).map((f: any) => {
        const line = clampLine(doc, Number(f?.line));
        const range = new vscode.Range(line, 0, line, doc.lineAt(line).text.length);
        const message = String(f?.details || f?.title || 'Potential issue detected by Astro');
        const d = new vscode.Diagnostic(range, message, toSeverity(f?.severity));
        d.source = 'Astro AI';
        d.code = f?.title ? String(f.title) : 'astro-live';
        return d;
      });

      this.diagnostics.set(doc.uri, diagnostics);

      const patterns = this.antiPatternTracker.detect(doc.getText(), findings);
      const advisories = this.antiPatternTracker.register(patterns);
      for (const pattern of patterns) {
        await this.memoryEngine.recordAntiPattern(pattern);
        await this.memoryEngine.markSuggestion(doc.uri.fsPath, pattern);
      }

      if (advisories.length > 0) {
        void vscode.window.showWarningMessage(`Astro advisory: ${advisories[0].message}`);
      }

      const surprise = this.surpriseEngine.maybeQuestion({
        findings,
        repeatedPattern: advisories[0]?.pattern,
        complexityTrigger: this.behaviorEngine.shouldAskComplexityQuestion(findings),
      });

      if (findings.length > 0 && this.autoOpenSuggestions()) {
        this.suggestions.setPayload({
          mode: 'live_monitor',
          file: doc.uri.fsPath,
          adaptive_mode: this.behaviorEngine.mode,
          findings,
          advisories,
          surprise_question: surprise || undefined,
          raw: result.raw,
        });
      }

      if (surprise) {
        void vscode.window.showInformationMessage(`Astro surprise: ${surprise}`);
      }

      await this.voiceEngine.maybeSpeakCritical(findings);
    } catch {
      // Keep monitoring silent; user can still run explicit commands.
    } finally {
      this.inFlight.delete(key);
    }
  }
}
