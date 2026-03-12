import type { AgentOutput, AgentTask, EvolutionAgent } from './base_agent.js';

export class DebugAgent implements EvolutionAgent {
  id = 'debug_agent';

  supports(request: string): boolean {
    return /\b(error|bug|exception|failing|trace|stack|crash|fix)\b/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    return {
      agent: this.id,
      summary: `Debug Agent: failure-analysis path prepared for '${task.request.slice(0, 100)}'`,
      suggested_tools: ['analyze', 'fix', 'anti_pattern_check', 'terminal_ops'],
    };
  }
}
