export interface ParsedGoal {
  raw_goal: string;
  domain: 'product' | 'coding' | 'research' | 'automation' | 'general';
  complexity: number;
  outcomes: string[];
}

export class GoalParser {
  parse(goal: string): ParsedGoal {
    const text = String(goal || '').trim();
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean).length;

    let domain: ParsedGoal['domain'] = 'general';
    if (/\b(saas|product|startup|mvp|deploy)\b/.test(lower)) domain = 'product';
    else if (/\b(code|api|backend|frontend|react|typescript|node)\b/.test(lower)) domain = 'coding';
    else if (/\b(research|compare|study|benchmark)\b/.test(lower)) domain = 'research';
    else if (/\b(automation|script|workflow|pipeline|cron|ci\/cd)\b/.test(lower)) domain = 'automation';

    const outcomes: string[] = [];
    if (/\b(build|create|implement|develop)\b/.test(lower)) outcomes.push('implementation');
    if (/\b(scale|performance|optimi[sz]e)\b/.test(lower)) outcomes.push('optimization');
    if (/\b(research|compare|analy[sz]e)\b/.test(lower)) outcomes.push('research');
    if (/\b(launch|deploy|release)\b/.test(lower)) outcomes.push('deployment');

    let complexity = Math.min(100, Math.round(words * 1.6));
    if (domain === 'product') complexity += 25;
    if (/\b(multi|end-to-end|architecture|system design|distributed)\b/.test(lower)) complexity += 20;
    complexity = Math.max(10, Math.min(100, complexity));

    return { raw_goal: text, domain, complexity, outcomes };
  }
}
