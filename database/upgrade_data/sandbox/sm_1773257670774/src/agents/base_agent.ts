export interface AgentTask {
  request: string;
  context?: Record<string, unknown>;
}

export interface AgentOutput {
  agent: string;
  summary: string;
  suggested_tools: string[];
}

export interface EvolutionAgent {
  id: string;
  supports(request: string): boolean;
  run(task: AgentTask): Promise<AgentOutput>;
}
