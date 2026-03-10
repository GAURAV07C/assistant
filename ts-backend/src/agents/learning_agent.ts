import type { AgentOutput, AgentTask, EvolutionAgent } from './base_agent.js';

export class LearningAgent implements EvolutionAgent {
  id = 'learning_agent';

  supports(request: string): boolean {
    return /\b(learn|roadmap|skill|curriculum|interview|practice)\b/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    return {
      agent: this.id,
      summary: `Learning Agent: skill-gap based learning objective generated for '${task.request.slice(0, 100)}'`,
      suggested_tools: ['skill_update', 'doc_retrieve'],
    };
  }
}
