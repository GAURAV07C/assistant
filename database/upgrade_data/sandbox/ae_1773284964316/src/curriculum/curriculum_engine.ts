import type { SkillGraph } from '../skills/skill_tracker.js';
import { ProgressTracker } from './progress_tracker.js';
import { SkillTree } from './skill_tree.js';

export interface CurriculumItem {
  skill: string;
  current_level: string;
  target_level: 'intermediate' | 'advanced';
  roadmap: string[];
}

export class CurriculumEngine {
  private readonly skillTree = new SkillTree();
  private readonly progress = new ProgressTracker();

  generateRoadmap(graph: SkillGraph): CurriculumItem[] {
    const out: CurriculumItem[] = [];
    const weak = this.skillTree.detectGaps(graph, 5);

    for (const node of weak.map((n) => ({ name: n.skill, score: n.score, level: n.level }))) {
      out.push({
        skill: node.name,
        current_level: node.level,
        target_level: node.score < 35 ? 'intermediate' : 'advanced',
        roadmap: [
          `Revise fundamentals of ${node.name}`,
          `Build 2 project tasks focused on ${node.name}`,
          `Solve production-style debugging scenarios for ${node.name}`,
          `Add weekly review and measurable benchmark`,
        ],
      });
    }

    return out;
  }

  getNextRecommendedTask(userProfile: SkillGraph): CurriculumItem | null {
    const roadmap = this.generateRoadmap(userProfile);
    return roadmap.length > 0 ? roadmap[0] : null;
  }

  updateSkillCompletion(skillId: string, result: 'pass' | 'fail' | 'partial') {
    return this.progress.updateSkillCompletion(skillId, result);
  }

  trackProgress(metrics: Record<string, number>) {
    return this.progress.trackProgress(metrics);
  }

  suggestLearningResources(taskId: string): string[] {
    const skill = String(taskId || '').toLowerCase();
    return [
      `Official documentation for ${skill || 'target skill'}`,
      `Hands-on project exercise focused on ${skill || 'core fundamentals'}`,
      `Interview-style problem set for ${skill || 'system thinking'}`,
    ];
  }
}
