export interface CuriosityDecision {
  curiosity_score: number;
  learning_focus: string[];
}

export class CuriosityEngine {
  decide(input: { knowledge_gaps: string[]; recent_quality_score: number }): CuriosityDecision {
    const gapFactor = Math.min(40, input.knowledge_gaps.length * 6);
    const qualityPenalty = input.recent_quality_score < 70 ? 20 : input.recent_quality_score < 80 ? 10 : 0;
    const score = Math.max(0, Math.min(100, 40 + gapFactor + qualityPenalty));

    return {
      curiosity_score: score,
      learning_focus: input.knowledge_gaps.slice(0, 6),
    };
  }
}
