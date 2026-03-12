export interface OptimizationDirective {
  id: string;
  strategy: string;
  impact: 'low' | 'medium' | 'high';
}

export class SystemOptimizer {
  optimize(input: {
    evaluation_score: number;
    reasoning_fail_rate: number;
    tool_failure_rate: number;
  }): OptimizationDirective[] {
    const directives: OptimizationDirective[] = [];

    if (input.reasoning_fail_rate > 0.3) {
      directives.push({
        id: 'increase_reasoning_depth',
        strategy: 'Route complex tasks to planning + evaluation agents before final response',
        impact: 'high',
      });
    }

    if (input.tool_failure_rate > 0.25) {
      directives.push({
        id: 'tighten_tool_prechecks',
        strategy: 'Validate tool input/context before execution and retry only when context changed',
        impact: 'medium',
      });
    }

    if (input.evaluation_score >= 80) {
      directives.push({
        id: 'focus_on_latency',
        strategy: 'Prefer fast brain for low complexity tasks to reduce response time',
        impact: 'low',
      });
    }

    return directives;
  }
}
