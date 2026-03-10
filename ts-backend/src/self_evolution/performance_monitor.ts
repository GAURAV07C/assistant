export class PerformanceMonitor {
  snapshot(input: {
    avg_score: number;
    success_rate: number;
    tool_failure_rate: number;
    system_intelligence_score: number;
  }) {
    return {
      ...input,
      ts: new Date().toISOString(),
      health: input.avg_score >= 75 && input.success_rate >= 0.7 ? 'stable' : 'needs_attention',
    };
  }
}
