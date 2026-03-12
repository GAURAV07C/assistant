import { analysisSkill } from './analysis/index.js';
import { automationSkill } from './automation/index.js';
import { codingSkill } from './coding/index.js';
import { productivitySkill } from './productivity/index.js';
import { researchSkill } from './research/index.js';
import type { SkillModule } from './types.js';

export function builtinSkills(): SkillModule[] {
  return [codingSkill, researchSkill, automationSkill, analysisSkill, productivitySkill];
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface SkillProfile {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  level: SkillLevel;
  intelligence_score: number;
  usage_count: number;
  success_count: number;
  failure_count: number;
  updated_at: string;
}

const DEFAULT_SKILLS: Array<{ id: string; name: string; category: string; description: string }> = [
  { id: 'coding', name: 'coding', category: 'coding', description: 'Code implementation, debugging, refactor and API work.' },
  { id: 'research', name: 'research', category: 'research', description: 'Research sources, compare options, validate facts.' },
  { id: 'automation', name: 'automation', category: 'automation', description: 'Automate repetitive work using scripts/tools.' },
  { id: 'data_analysis', name: 'data_analysis', category: 'analysis', description: 'Analyze data patterns and quality signals.' },
  { id: 'web_scraping', name: 'web_scraping', category: 'research', description: 'Structured website/document extraction patterns.' },
  { id: 'prompt_engineering', name: 'prompt_engineering', category: 'productivity', description: 'Prompt structuring and response optimization.' },
];

export function defaultSkillProfiles(): SkillProfile[] {
  const now = new Date().toISOString();
  return DEFAULT_SKILLS.map((s) => ({
    ...s,
    enabled: true,
    level: 'beginner',
    intelligence_score: 0,
    usage_count: 0,
    success_count: 0,
    failure_count: 0,
    updated_at: now,
  }));
}
