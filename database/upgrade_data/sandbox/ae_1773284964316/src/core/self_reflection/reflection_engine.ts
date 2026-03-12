import { ReflectionEvaluator } from './evaluator.js';
import { ReflectionReviewLogs } from './review_logs.js';

export interface ReflectionResult {
  quality_score: number;
  issues: string[];
  improvement_hints: string[];
}

export class ReflectionEngine {
  private readonly evaluator = new ReflectionEvaluator();
  private readonly logs = new ReflectionReviewLogs();

  analyzeResponse(response: string, context?: string): ReflectionResult {
    const base = this.evaluator.analyzeResponse(response, context);
    const hints = this.generateImprovementHints(base.issues);
    return { quality_score: base.quality_score, issues: base.issues, improvement_hints: hints };
  }

  scoreMistakePatterns(userFeedback: string): { score: number; tags: string[] } {
    return this.evaluator.scoreMistakePatterns(userFeedback);
  }

  generateImprovementHints(issues: string[]): string[] {
    return issues.map((issue) => {
      switch (issue) {
        case 'short_answer': return 'Add concrete implementation steps and expected output.';
        case 'poor_structure': return 'Use structured format: problem -> options -> decision -> next action.';
        case 'uncertainty_unexplained': return 'Explicitly call out assumptions and unknowns.';
        case 'missing_validation': return 'Include tests, edge cases, and verification checklist.';
        default: return 'Improve factual precision and actionability.';
      }
    });
  }

  updateBehaviorProfile(payload: {
    session_id: string;
    request: string;
    response: string;
    context?: string;
    feedback?: string;
  }): ReflectionResult {
    const reflection = this.analyzeResponse(payload.response, payload.context || payload.request);
    const feedback = this.scoreMistakePatterns(payload.feedback || '');

    this.logs.append({
      ts: new Date().toISOString(),
      session_id: payload.session_id,
      reflection,
      feedback,
    });

    return reflection;
  }

  recentReviews(limit = 50): Record<string, unknown>[] {
    return this.logs.recent(limit);
  }
}
