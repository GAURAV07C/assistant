import type { SkillModule } from '../types.js';

export const productivitySkill: SkillModule = {
  id: 'productivity.flow',
  category: 'productivity',
  description: 'Planning, summarization, and execution momentum management.',
  prompts: [
    'Break work into concrete milestones.',
    'Keep responses outcome-oriented and concise.',
  ],
  workflows: [
    'goal_parse',
    'milestone_plan',
    'next_action',
  ],
  tools: ['doc_retrieve', 'memory_update', 'analyze'],
  execute(input) {
    return {
      summary: `Productivity skill activated for: ${String(input.message || '').slice(0, 140)}`,
      suggested_tools: ['doc_retrieve', 'memory_update'],
      workflow: ['Parse objective', 'Create milestones', 'Recommend next step'],
    };
  },
};
