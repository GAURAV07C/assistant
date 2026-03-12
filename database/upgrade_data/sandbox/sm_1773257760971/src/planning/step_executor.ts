import type { PlannedStep } from './task_planner.js';

export class StepExecutor {
  chooseTool(step: PlannedStep, availableTools: string[]): string {
    if (availableTools.includes(step.suggested_tool)) return step.suggested_tool;
    if (availableTools.includes('analyze')) return 'analyze';
    if (availableTools.includes('doc_retrieve')) return 'doc_retrieve';
    return availableTools[0] || 'analyze';
  }

  buildExecutionTrace(steps: PlannedStep[], availableTools: string[]): string[] {
    return steps.map((step) => {
      const tool = this.chooseTool(step, availableTools);
      return `${step.id}: ${step.title} -> ${tool}`;
    });
  }
}
