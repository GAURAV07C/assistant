import { TaskRecord } from '../task_memory/task_store.js';
import { PerformanceSnapshot } from '../self_improvement/performance_analyzer.js';

export interface ReflectionReport {
  successScore: number;
  mistakeType: 'reasoning' | 'tool' | 'knowledge';
  improvementSuggestion: string;
}

export class ReflectionEngine {
  analyze(input: {
    execution: TaskRecord;
    performance: PerformanceSnapshot;
    agentOutputs: Array<{ agent: string; summary: string }>;
  }): ReflectionReport {
    const { evaluation_score } = input.performance;
    let mistakeType: ReflectionReport['mistakeType'] = 'knowledge';
    if (input.execution.tools.length > 2 && input.execution.success === false) mistakeType = 'tool';
    else if (evaluation_score < 60) mistakeType = 'reasoning';

    const suggestion = mistakeType === 'tool'
      ? 'Review tool integration coverage and add retries or fallback behavior.'
      : mistakeType === 'reasoning'
        ? 'Add additional reasoning prompts or chain-of-thought supervision for this pattern.'
        : 'Augment knowledge base with relevant concepts before answering similar prompts.';

    return {
      successScore: Math.max(0, Math.min(100, evaluation_score)),
      mistakeType,
      improvementSuggestion: suggestion,
    };
  }
}
