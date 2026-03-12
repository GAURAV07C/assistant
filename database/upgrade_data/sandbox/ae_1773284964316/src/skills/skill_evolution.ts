import type { SkillLevel, SkillProfile } from './skill_registry.js';
import { SkillMemory } from './skill_memory.js';

export type SkillResult = 'success' | 'partial' | 'failure';

function levelFromScore(score: number): SkillLevel {
  if (score >= 85) return 'expert';
  if (score >= 65) return 'advanced';
  if (score >= 35) return 'intermediate';
  return 'beginner';
}

export class SkillEvolutionEngine {
  constructor(private readonly memory = new SkillMemory()) {}

  evolve(profile: SkillProfile, result: SkillResult, notes?: string): SkillProfile {
    const delta = result === 'success' ? 6 : result === 'partial' ? 2 : -3;
    const nextScore = Math.max(0, Math.min(100, profile.intelligence_score + delta));
    const next: SkillProfile = {
      ...profile,
      intelligence_score: nextScore,
      level: levelFromScore(nextScore),
      usage_count: profile.usage_count + 1,
      success_count: profile.success_count + (result === 'success' ? 1 : 0),
      failure_count: profile.failure_count + (result === 'failure' ? 1 : 0),
      updated_at: new Date().toISOString(),
    };

    if (notes && result !== 'success') {
      this.memory.updateSkillMemory(profile.id, { mistakes: [notes] });
    } else if (notes && result === 'success') {
      this.memory.updateSkillMemory(profile.id, { best_practices: [notes] });
    }
    return next;
  }
}
