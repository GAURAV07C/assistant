import type { AgentOutput, AgentTask, EvolutionAgent } from './base_agent.js';

export class AutomationAgent implements EvolutionAgent {
  id = 'automation_agent';

  supports(request: string): boolean {
    return /\b(automate|script|pipeline|terminal|git|deploy|ci\/cd)\b/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    return {
      agent: this.id,
      summary: `Automation Agent: automation flow prepared for '${task.request.slice(0, 100)}'`,
      suggested_tools: ['terminal_ops', 'git_ops', 'file_ops'],
    };
  }
}
