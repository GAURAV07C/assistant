import type { SkillModule } from '../types.js';

export const researchSkill: SkillModule = {
  id: 'research.web',
  category: 'research',
  description: 'Web-backed research, comparison, and evidence-driven synthesis.',
  prompts: [
    'Gather primary facts from trusted sources.',
    'Highlight uncertainty and missing evidence.',
  ],
  workflows: [
    'detect_knowledge_gap',
    'web_research',
    'fact_synthesis',
  ],
  tools: ['web_lookup', 'analyze'],
  execute(input) {
    return {
      summary: `Research skill activated for: ${String(input.message || '').slice(0, 140)}`,
      suggested_tools: ['web_lookup', 'analyze'],
      workflow: ['Detect gap', 'Collect sources', 'Synthesize evidence-backed answer'],
    };
  },
};
