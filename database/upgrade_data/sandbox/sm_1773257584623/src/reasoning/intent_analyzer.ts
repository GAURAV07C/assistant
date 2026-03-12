export type ReasoningIntent = 'simple_chat' | 'coding_help' | 'research' | 'architecture' | 'complex_problem';

export class IntentAnalyzer {
  analyze(query: string): { intent: ReasoningIntent; complexity: number } {
    const q = String(query || '').toLowerCase();
    let complexity = Math.min(100, Math.round(q.split(/\s+/).filter(Boolean).length * 1.4));

    if (/\b(architecture|system design|tradeoff|scalable|distributed)\b/.test(q)) complexity += 28;
    if (/\b(research|compare|sources|deep|analyze)\b/.test(q)) complexity += 20;
    if (/\b(debug|error|fix|bug)\b/.test(q)) complexity += 12;
    if (/\b(step by step|multi-step|plan)\b/.test(q)) complexity += 14;

    complexity = Math.max(0, Math.min(100, complexity));
    if (/\breact|typescript|node|api|database|refactor|code\b/.test(q)) {
      return { intent: 'coding_help', complexity };
    }
    if (/\bresearch|sources|latest|compare\b/.test(q)) {
      return { intent: 'research', complexity };
    }
    if (/\barchitecture|system design|distributed|scalab/.test(q)) {
      return { intent: 'architecture', complexity };
    }
    if (complexity >= 70) return { intent: 'complex_problem', complexity };
    return { intent: 'simple_chat', complexity };
  }
}
