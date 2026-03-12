export interface ReflectionEvaluation {
  quality_score: number;
  issues: string[];
}

export class ReflectionEvaluator {
  analyzeResponse(response: string, context?: string): ReflectionEvaluation {
    const text = String(response || '');
    const ctx = String(context || '');
    const issues: string[] = [];

    if (text.trim().length < 60) issues.push('short_answer');
    if (!/[.?!]/.test(text)) issues.push('poor_structure');
    if (/\b(maybe|possibly|not sure)\b/i.test(text) && !/\bassumption\b/i.test(text)) issues.push('uncertainty_unexplained');
    if (/\b(code|fix|refactor)\b/i.test(ctx) && !/\b(test|edge|validate)\b/i.test(text)) issues.push('missing_validation');

    return {
      quality_score: Math.max(0, Math.min(100, 90 - issues.length * 12)),
      issues,
    };
  }

  scoreMistakePatterns(userFeedback: string): { score: number; tags: string[] } {
    const fb = String(userFeedback || '').toLowerCase();
    const tags: string[] = [];
    if (/wrong|incorrect|bug/.test(fb)) tags.push('accuracy_issue');
    if (/confus|unclear/.test(fb)) tags.push('clarity_issue');
    if (/slow|latency/.test(fb)) tags.push('speed_issue');
    const score = Math.max(0, 100 - tags.length * 20);
    return { score, tags };
  }
}
