import type { AgentOutput, AgentTask, EvolutionAgent } from './base_agent.js';

export class ResearchAgent implements EvolutionAgent {
  id = 'research_agent';

  supports(request: string): boolean {
    return /\b(research|compare|latest|framework|trend|ai)\b/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    return {
      agent: this.id,
      summary: `Research Agent: evidence-backed research route prepared for '${task.request.slice(0, 100)}'`,
      suggested_tools: ['web_lookup', 'analyze'],
    };
  }
}
