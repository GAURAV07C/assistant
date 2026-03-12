import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';
import { GoalManager } from './goal_manager.js';
import { LearningManager } from './learning_manager.js';
import { SkillManager } from './skill_manager.js';
import { SystemOptimizer } from './system_optimizer.js';

const META_STATE_FILE = path.join(UPGRADE_DATA_DIR, 'meta_intelligence_state.json');

export interface MetaSystemState {
  evaluation_score: number;
  average_skill_intelligence: number;
  skills: Array<{ id: string; intelligence_score: number }>;
  repeated_mistakes: string[];
  research_gaps: string[];
  reasoning_fail_rate: number;
  tool_failure_rate: number;
  active_agents: string[];
}

export interface MetaDecision {
  generated_at: string;
  intelligence_score: number;
  learning_goals: ReturnType<GoalManager['createGoals']>;
  learning_tasks: ReturnType<LearningManager['buildTasks']>;
  skill_actions: ReturnType<SkillManager['recommendUpgrades']>;
  optimizer_directives: ReturnType<SystemOptimizer['optimize']>;
  active_agents: string[];
}

export class MetaController {
  private readonly goals = new GoalManager();
  private readonly learning = new LearningManager();
  private readonly skills = new SkillManager();
  private readonly optimizer = new SystemOptimizer();

  analyze(state: MetaSystemState): MetaDecision {
    const lowSkills = state.skills.filter((s) => s.intelligence_score < 55).map((s) => s.id);
    const topSkills = state.skills
      .slice()
      .sort((a, b) => b.intelligence_score - a.intelligence_score)
      .slice(0, 5);

    const learningGoals = this.goals.createGoals({
      evaluation_score: state.evaluation_score,
      average_skill_intelligence: state.average_skill_intelligence,
      low_skills: lowSkills,
      repeated_mistakes: state.repeated_mistakes,
      research_gaps: state.research_gaps,
    });

    const decision: MetaDecision = {
      generated_at: new Date().toISOString(),
      intelligence_score: this.computeIntelligenceScore(state),
      learning_goals: learningGoals,
      learning_tasks: this.learning.buildTasks(learningGoals),
      skill_actions: this.skills.recommendUpgrades({
        top_skills: topSkills,
        weak_skills: state.skills.filter((s) => s.intelligence_score < 60).slice(0, 8),
      }),
      optimizer_directives: this.optimizer.optimize({
        evaluation_score: state.evaluation_score,
        reasoning_fail_rate: state.reasoning_fail_rate,
        tool_failure_rate: state.tool_failure_rate,
      }),
      active_agents: state.active_agents,
    };

    this.persist(decision);
    return decision;
  }

  latest(): MetaDecision | null {
    if (!fs.existsSync(META_STATE_FILE)) return null;
    try {
      return JSON.parse(fs.readFileSync(META_STATE_FILE, 'utf8')) as MetaDecision;
    } catch {
      return null;
    }
  }

  private persist(decision: MetaDecision): void {
    fs.mkdirSync(path.dirname(META_STATE_FILE), { recursive: true });
    fs.writeFileSync(META_STATE_FILE, JSON.stringify(decision, null, 2), 'utf8');
  }

  private computeIntelligenceScore(state: MetaSystemState): number {
    const base = (state.evaluation_score * 0.4) + (state.average_skill_intelligence * 0.4);
    const penalty = Math.min(25, state.repeated_mistakes.length * 4);
    const researchBoost = Math.min(10, state.research_gaps.length === 0 ? 8 : 3);
    return Math.max(0, Math.min(100, Math.round(base - penalty + researchBoost)));
  }
}
