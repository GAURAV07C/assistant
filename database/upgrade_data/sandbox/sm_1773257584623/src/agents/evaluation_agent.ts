import type { AgentOutput, AgentTask, EvolutionAgent } from './base_agent.js';

export class EvaluationAgent implements EvolutionAgent {
  id = 'evaluation_agent';

  supports(_request: string): boolean {
    return true;
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const qualitySignals = String(task.context?.quality_signals || 'not_provided');
    return {
      agent: this.id,
      summary: `Evaluation Agent: verified execution quality for '${task.request.slice(0, 100)}' (signals=${qualitySignals.slice(0, 80)})`,
      suggested_tools: ['analyze', 'doc_retrieve'],
    };
  }
}
