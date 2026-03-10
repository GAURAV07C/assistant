import * as vscode from 'vscode';

export type AdaptiveMode = 'soft' | 'mentor' | 'brutal';

export interface BehaviorFinding {
  severity?: string;
  title?: string;
  details?: string;
}

export class BehaviorEngine {
  get mode(): AdaptiveMode {
    const cfg = vscode.workspace.getConfiguration();
    const v = String(cfg.get('astro.adaptiveMode', 'mentor')).toLowerCase();
    if (v === 'soft' || v === 'brutal' || v === 'mentor') return v;
    return 'mentor';
  }

  selectFindings(input: BehaviorFinding[]): BehaviorFinding[] {
    const items = Array.isArray(input) ? input : [];
    if (this.mode === 'soft') {
      return items.filter((f) => /(critical|high|error)/i.test(String(f.severity || '')));
    }
    if (this.mode === 'mentor') {
      return items.filter((f) => !/(info|nit|style-only)/i.test(String(f.severity || ''))).slice(0, 30);
    }
    return items.slice(0, 50);
  }

  shouldAskComplexityQuestion(findings: BehaviorFinding[]): boolean {
    if (this.mode !== 'brutal') return false;
    return findings.some((f) => /(complexity|performance|big-?o|optimi)/i.test(`${f.title || ''} ${f.details || ''}`));
  }
}
