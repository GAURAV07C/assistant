import type { AgentOutput, AgentTask, EvolutionAgent } from './base_agent.js';

export class PlanningAgent implements EvolutionAgent {
  id = 'planning_agent';

  supports(request: string): boolean {
    return /\b(plan|roadmap|milestone|phase|strategy|architecture)\b/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const steps = this.decompose(task.request);
    return {
      agent: this.id,
      summary: `Planning Agent: created ${steps.length} structured steps for '${task.request.slice(0, 100)}'`,
      suggested_tools: ['analyze', 'doc_retrieve', 'web_lookup'],
    };
  }

  decompose(goal: string): string[] {
    const clean = String(goal || '').trim();
    if (!clean) return ['Clarify goal scope', 'Define expected outcome', 'Create execution checklist'];

    const fragments = clean
      .split(/(?:,|\.| then | and then | -> |\n)/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 4)
      .slice(0, 8);

    if (fragments.length >= 2) return fragments.map((f) => `Execute: ${f}`);

    return [
      'Define objective and constraints',
      'Research references and baseline architecture',
      'Implement incrementally with validation checkpoints',
      'Run evaluation and fix quality gaps',
    ];
  }
}
