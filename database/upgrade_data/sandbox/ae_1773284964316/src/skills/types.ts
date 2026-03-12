export type SkillCategory = 'coding' | 'research' | 'automation' | 'analysis' | 'productivity';

export interface SkillExecutionInput {
  message: string;
  context?: Record<string, unknown>;
}

export interface SkillExecutionOutput {
  summary: string;
  suggested_tools: string[];
  workflow: string[];
}

export interface SkillModule {
  id: string;
  category: SkillCategory;
  description: string;
  prompts: string[];
  workflows: string[];
  tools: string[];
  execute(input: SkillExecutionInput): SkillExecutionOutput;
}
