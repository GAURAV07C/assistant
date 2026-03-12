import type { LongTermGoal } from './goal_registry.js';

export class GoalEvaluator {
  evaluate(goals: LongTermGoal[]) {
    const total = goals.length;
    const completed = goals.filter((g) => g.status === 'completed').length;
    const avg = total ? Math.round(goals.reduce((a, b) => a + b.progress, 0) / total) : 0;
    return {
      total_goals: total,
      completed_goals: completed,
      average_progress: avg,
      completion_rate: total ? Number((completed / total).toFixed(2)) : 0,
    };
  }
}
