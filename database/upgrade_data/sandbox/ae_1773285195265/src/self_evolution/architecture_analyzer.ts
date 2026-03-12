export class ArchitectureAnalyzer {
  analyze(input: { avg_score: number; failure_rate: number; curiosity_score: number }) {
    const weaknesses: string[] = [];
    if (input.avg_score < 70) weaknesses.push('response_quality_pipeline');
    if (input.failure_rate > 0.25) weaknesses.push('tool_reliability_layer');
    if (input.curiosity_score > 70) weaknesses.push('knowledge_coverage_depth');

    return {
      weaknesses,
      recommendation_level: weaknesses.length >= 2 ? 'high' : weaknesses.length ? 'medium' : 'low',
    };
  }
}
