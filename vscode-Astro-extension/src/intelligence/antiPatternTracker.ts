export interface TrackerFinding {
  title?: string;
  details?: string;
  severity?: string;
}

export interface PatternAdvisory {
  pattern: string;
  count: number;
  message: string;
}

const PATTERN_RULES: Array<{ id: string; re: RegExp; message: string }> = [
  { id: 'nested_loops', re: /for\s*\([^)]*\)\s*\{[\s\S]{0,500}for\s*\([^)]*\)/i, message: 'Nested loops detected repeatedly. Consider optimizing complexity.' },
  { id: 'missing_try_catch', re: /\bawait\s+[a-zA-Z0-9_$.]+\([^)]*\)\s*;?/i, message: 'Missing error handling pattern detected. Add try/catch around risky async calls.' },
  { id: 'console_log_production', re: /\bconsole\.log\(/i, message: 'console.log usage is recurring. Prefer structured logger or guarded debug output.' },
  { id: 'no_edge_case_handling', re: /\b(todo|fixme|hack)\b/i, message: 'Edge-case handling appears weak. Add boundary and invalid-input checks.' },
];

export class AntiPatternTracker {
  private readonly counts = new Map<string, number>();
  private readonly advisoryTs = new Map<string, number>();
  private readonly advisoryCooldownMs = 2 * 60 * 1000;

  detect(text: string, findings: TrackerFinding[]): string[] {
    const source = String(text || '');
    const found = new Set<string>();
    for (const rule of PATTERN_RULES) {
      if (rule.id === 'no_edge_case_handling') {
        const hasEdgeSignal = /\b(if\s*\(|switch\s*\(|throw\s+new\s+Error|return\s+null|guard)\b/i.test(source);
        if (!hasEdgeSignal && source.length > 120) found.add(rule.id);
        continue;
      }

      if (rule.id === 'missing_try_catch') {
        const hasAwait = rule.re.test(source);
        const hasTry = /try\s*\{[\s\S]{0,2000}catch\s*\(/i.test(source);
        if (hasAwait && !hasTry) found.add(rule.id);
        continue;
      }

      if (rule.re.test(source)) found.add(rule.id);
    }

    for (const f of findings || []) {
      const hay = `${String(f.title || '')}\n${String(f.details || '')}`.toLowerCase();
      if (/(nested loop|quadratic|o\(n\^2\))/.test(hay)) found.add('nested_loops');
      if (/(try\/catch|error handling|uncaught|exception)/.test(hay)) found.add('missing_try_catch');
      if (/(console\.log|debug print|production log)/.test(hay)) found.add('console_log_production');
      if (/(edge case|boundary|null case|empty input)/.test(hay)) found.add('no_edge_case_handling');
    }
    return Array.from(found);
  }

  register(patterns: string[]): PatternAdvisory[] {
    const advisories: PatternAdvisory[] = [];
    for (const pattern of patterns) {
      const next = (this.counts.get(pattern) || 0) + 1;
      this.counts.set(pattern, next);
      if (next < 3) continue;
      const now = Date.now();
      const last = this.advisoryTs.get(pattern) || 0;
      if (now - last < this.advisoryCooldownMs) continue;
      this.advisoryTs.set(pattern, now);
      advisories.push({
        pattern,
        count: next,
        message: PATTERN_RULES.find((r) => r.id === pattern)?.message || `${pattern} repeated frequently.`,
      });
    }
    return advisories;
  }
}
