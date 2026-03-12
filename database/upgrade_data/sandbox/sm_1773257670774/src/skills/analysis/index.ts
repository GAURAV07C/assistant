import type { SkillModule } from '../types.js';

export const analysisSkill: SkillModule = {
  id: 'analysis.quality',
  category: 'analysis',
  description: 'Quality/performance/security analysis with prioritization.',
  prompts: [
    'Prioritize findings by severity and impact.',
    'Recommend measurable improvements.',
  ],
  workflows: [
    'collect_findings',
    'rank_by_impact',
    'output_action_plan',
  ],
  tools: ['analyze', 'performance_scan', 'security_scan'],
  execute(input) {
    return {
      summary: `Analysis skill activated for: ${String(input.message || '').slice(0, 140)}`,
      suggested_tools: ['analyze'],
      workflow: ['Collect risks', 'Prioritize high-impact fixes', 'Propose action plan'],
    };
  },
};
