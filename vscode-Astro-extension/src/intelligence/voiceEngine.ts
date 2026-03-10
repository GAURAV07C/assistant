import * as vscode from 'vscode';
import type { BehaviorFinding } from './behaviorEngine';

export class VoiceEngine {
  private lastSpokenAt = 0;
  private readonly cooldownMs = 20_000;
  private emitter?: (text: string) => void;
  private pending: string[] = [];

  private enabled(): boolean {
    const cfg = vscode.workspace.getConfiguration();
    return Boolean(cfg.get('astro.voiceEnabled', false));
  }

  private shouldSpeakFinding(findings: BehaviorFinding[]): string | null {
    const critical = findings.find((f) => /(critical|high|error)/i.test(String(f.severity || '')));
    if (!critical) return null;
    const confidenceLike = String(critical.title || '').trim().length >= 4 || String(critical.details || '').trim().length >= 20;
    if (!confidenceLike) return null;
    return String(critical.title || critical.details || 'Critical issue detected');
  }

  async maybeSpeakCritical(findings: BehaviorFinding[]): Promise<boolean> {
    if (!this.enabled()) return false;
    const now = Date.now();
    if (now - this.lastSpokenAt < this.cooldownMs) return false;
    const message = this.shouldSpeakFinding(findings);
    if (!message) return false;
    const safeMessage = `Astro alert. ${message.replace(/\s+/g, ' ').slice(0, 200)}`;
    const delivered = this.emit(safeMessage);
    if (delivered) this.lastSpokenAt = now;
    return delivered;
  }

  registerEmitter(emitter: (text: string) => void): void {
    this.emitter = emitter;
    if (!this.emitter || this.pending.length === 0) return;
    const toFlush = this.pending.slice();
    this.pending = [];
    for (const item of toFlush) {
      try {
        this.emitter(item);
      } catch {
        // ignore webview errors
      }
    }
  }

  private emit(text: string): boolean {
    if (!this.emitter) {
      this.pending.push(text);
      this.pending = this.pending.slice(-6);
      return false;
    }
    try {
      this.emitter(text);
      return true;
    } catch {
      return false;
    }
  }
}
