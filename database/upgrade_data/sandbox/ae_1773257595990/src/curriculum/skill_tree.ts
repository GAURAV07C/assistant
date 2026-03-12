import type { SkillGraph } from '../skills/skill_tracker.js';

export interface SkillGap {
  skill: string;
  score: number;
  level: string;
}

export class SkillTree {
  detectGaps(graph: SkillGraph, max = 5): SkillGap[] {
    return graph.nodes
      .filter((n) => n.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, max)
      .map((n) => ({ skill: n.name, score: n.score, level: n.level }));
  }
}
