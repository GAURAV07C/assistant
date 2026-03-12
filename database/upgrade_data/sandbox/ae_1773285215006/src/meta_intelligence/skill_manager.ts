export interface SkillUpgradeAction {
  skill_id: string;
  action: 'practice' | 'research' | 'stabilize';
  reason: string;
}

export class SkillManager {
  recommendUpgrades(input: {
    top_skills: Array<{ id: string; intelligence_score: number }>;
    weak_skills: Array<{ id: string; intelligence_score: number }>;
  }): SkillUpgradeAction[] {
    const actions: SkillUpgradeAction[] = [];

    for (const skill of input.weak_skills.slice(0, 4)) {
      actions.push({
        skill_id: skill.id,
        action: skill.intelligence_score < 40 ? 'practice' : 'research',
        reason: `Current intelligence score is ${skill.intelligence_score}`,
      });
    }

    for (const skill of input.top_skills.slice(0, 2)) {
      actions.push({
        skill_id: skill.id,
        action: 'stabilize',
        reason: 'High skill should be retained with periodic reinforcement',
      });
    }

    return actions;
  }
}
