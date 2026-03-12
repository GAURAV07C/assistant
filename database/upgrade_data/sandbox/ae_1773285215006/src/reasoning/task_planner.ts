import type { ReasoningIntent } from './intent_analyzer.js';

export interface PlannedTask {
  intent: ReasoningIntent;
  steps: string[];
  needs_research: boolean;
}

export class TaskPlanner {
  plan(intent: ReasoningIntent, query: string): PlannedTask {
    const steps = [
      'Clarify objective and constraints from user query',
      'Map relevant memory/context and known patterns',
      'Draft solution structure with tradeoffs',
      'Generate final answer with assumptions and next actions',
    ];
    const needsResearch = /\b(latest|research|compare|benchmark|source)\b/i.test(query) || intent === 'research' || intent === 'architecture';
    if (needsResearch) steps.splice(2, 0, 'Run targeted research and validate key facts');
    return {
      intent,
      steps,
      needs_research: needsResearch,
    };
  }
}
