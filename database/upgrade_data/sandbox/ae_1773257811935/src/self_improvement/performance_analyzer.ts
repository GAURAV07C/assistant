export interface PerformanceSnapshot {
  evaluation_score: number;
  reflection_score: number;
  success_rate: number;
  tool_failure_rate: number;
}

export class PerformanceAnalyzer {
  analyze(input: {
    evaluation_summary: { average_score?: number; success_rate?: number };
    reflection_scores: number[];
    tool_failures: number;
    total_tool_runs: number;
  }): PerformanceSnapshot {
    const evaluationScore = Math.round(input.evaluation_summary.average_score || 0);
    const reflectionScore = input.reflection_scores.length
      ? Math.round(input.reflection_scores.reduce((a, b) => a + b, 0) / input.reflection_scores.length)
      : 0;

    const successRate = Math.round(((input.evaluation_summary.success_rate || 0) * 100));
    const toolFailureRate = input.total_tool_runs > 0
      ? Number((input.tool_failures / input.total_tool_runs).toFixed(2))
      : 0;

    return {
      evaluation_score: evaluationScore,
      reflection_score: reflectionScore,
      success_rate: successRate,
      tool_failure_rate: toolFailureRate,
    };
  }
}
