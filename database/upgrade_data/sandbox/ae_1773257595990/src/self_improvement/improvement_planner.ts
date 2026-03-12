import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';
import type { MistakePattern } from './mistake_detector.js';
import type { PerformanceSnapshot } from './performance_analyzer.js';

const SELF_IMPROVEMENT_FILE = path.join(UPGRADE_DATA_DIR, 'self_improvement_plan.json');

export interface ImprovementPlan {
  created_at: string;
  priorities: string[];
  actions: string[];
  projected_impact: 'low' | 'medium' | 'high';
}

export class ImprovementPlanner {
  plan(performance: PerformanceSnapshot, mistakes: MistakePattern[]): ImprovementPlan {
    const priorities: string[] = [];
    const actions: string[] = [];

    if (performance.evaluation_score < 70) {
      priorities.push('response_quality');
      actions.push('Increase strategic mode usage for complex requests');
    }

    if (performance.tool_failure_rate > 0.2) {
      priorities.push('tool_reliability');
      actions.push('Run tool pre-check and fallback before retry');
    }

    const topMistake = mistakes[0];
    if (topMistake?.name === 'missing_context') {
      priorities.push('context_precision');
      actions.push('Ask one targeted clarification when ambiguity threshold is exceeded');
    }

    if (!priorities.length) {
      priorities.push('continuous_optimization');
      actions.push('Maintain current strategy and monitor drift');
    }

    const plan: ImprovementPlan = {
      created_at: new Date().toISOString(),
      priorities,
      actions,
      projected_impact: performance.evaluation_score < 60 ? 'high' : performance.evaluation_score < 80 ? 'medium' : 'low',
    };

    this.persist(plan);
    return plan;
  }

  latest(): ImprovementPlan | null {
    if (!fs.existsSync(SELF_IMPROVEMENT_FILE)) return null;
    try {
      return JSON.parse(fs.readFileSync(SELF_IMPROVEMENT_FILE, 'utf8')) as ImprovementPlan;
    } catch {
      return null;
    }
  }

  private persist(plan: ImprovementPlan): void {
    fs.mkdirSync(path.dirname(SELF_IMPROVEMENT_FILE), { recursive: true });
    fs.writeFileSync(SELF_IMPROVEMENT_FILE, JSON.stringify(plan, null, 2), 'utf8');
  }
}
