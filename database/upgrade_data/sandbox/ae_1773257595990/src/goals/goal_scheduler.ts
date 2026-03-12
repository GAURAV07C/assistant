import type { LongTermGoal } from './goal_registry.js';

export class GoalScheduler {
  schedule(goals: LongTermGoal[]): Array<{ goal_id: string; priority: number; reason: string }> {
    return goals
      .map((g) => ({
        goal_id: g.id,
        priority: g.status === 'completed' ? 0 : Math.max(1, 100 - g.progress),
        reason: g.status === 'completed' ? 'already_completed' : `progress_${g.progress}`,
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);
  }
}
