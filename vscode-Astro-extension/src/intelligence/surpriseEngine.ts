import * as vscode from 'vscode';
import type { BehaviorFinding } from './behaviorEngine';

export class SurpriseEngine {
  private readonly windowMs = 10 * 60 * 1000;
  private readonly limit = 3;
  private readonly fired: number[] = [];

  private enabled(): boolean {
    const cfg = vscode.workspace.getConfiguration();
    return Boolean(cfg.get('astro.surpriseQuestionsEnabled', true));
  }

  maybeQuestion(input: {
    findings: BehaviorFinding[];
    repeatedPattern?: string;
    complexityTrigger?: boolean;
  }): string | null {
    if (!this.enabled()) return null;
    const now = Date.now();
    while (this.fired.length > 0 && now - this.fired[0] > this.windowMs) this.fired.shift();
    if (this.fired.length >= this.limit) return null;

    const hasOptimization = input.findings.some((f) => /(optimization|performance|complexity|latency|memory)/i.test(`${f.title || ''} ${f.details || ''}`));
    const hasRepeated = !!input.repeatedPattern;
    const hasComplexity = !!input.complexityTrigger;
    if (!hasOptimization && !hasRepeated && !hasComplexity) return null;

    this.fired.push(now);
    if (hasRepeated && input.repeatedPattern) {
      return `Surprise check: is recurring "${input.repeatedPattern}" issue ko permanently prevent karne ke liye tumhari coding checklist me kya add karoge?`;
    }
    if (hasComplexity) {
      return 'Surprise check: is logic ka time complexity aur worst-case input kya hoga?';
    }
    return 'Surprise check: yahan optimization ka sabse high-impact step kya hoga, aur kaise measure karoge?';
  }
}
