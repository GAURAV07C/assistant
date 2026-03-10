export type SupportedIntent =
  | 'explain'
  | 'refactor'
  | 'fix'
  | 'analyze'
  | 'chat'
  | 'generate_snippet'
  | 'git_commit'
  | 'performance'
  | 'security';

export interface IntentDecision {
  intent: SupportedIntent;
  confidence: number;
}

type Rule = { intent: SupportedIntent; score: number; re: RegExp };

const RULES: Rule[] = [
  { intent: 'explain', score: 88, re: /\b(explain|samjha|understand|walkthrough)\b/i },
  { intent: 'refactor', score: 90, re: /\b(refactor|clean up|cleanup|restructure)\b/i },
  { intent: 'fix', score: 90, re: /\b(fix|bug|error|issue|crash|broken)\b/i },
  { intent: 'performance', score: 92, re: /\b(performance|optimi[sz]e|latency|slow|throughput)\b/i },
  { intent: 'security', score: 92, re: /\b(security|vulnerability|xss|sqli|csrf|auth)\b/i },
  { intent: 'analyze', score: 82, re: /\b(analy[sz]e|review|inspect|evaluate)\b/i },
  { intent: 'generate_snippet', score: 91, re: /\b(snippet|boilerplate|template|generate code)\b/i },
  { intent: 'git_commit', score: 95, re: /\b(commit message|git commit|conventional commit)\b/i },
];

export class IntentRouter {
  classify(input: string): IntentDecision {
    const text = String(input || '').trim();
    if (!text) return { intent: 'chat', confidence: 0 };

    let winner: IntentDecision = { intent: 'chat', confidence: 60 };
    for (const rule of RULES) {
      if (!rule.re.test(text)) continue;
      if (rule.score > winner.confidence) {
        winner = { intent: rule.intent, confidence: rule.score };
      }
    }

    if (winner.intent !== 'chat' && text.length < 8) {
      return { intent: winner.intent, confidence: Math.max(65, winner.confidence - 18) };
    }
    return winner;
  }
}
