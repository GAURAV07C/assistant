import type { LearningGoal } from './goal_manager.js';

export interface LearningTask {
  goal_id: string;
  title: string;
  steps: string[];
  owner_agent: string;
}

export class LearningManager {
  buildTasks(goals: LearningGoal[]): LearningTask[] {
    return goals.map((goal) => ({
      goal_id: goal.id,
      title: goal.title,
      owner_agent: goal.assigned_agent,
      steps: [
        'Collect relevant logs, failures, and successful examples',
        'Extract patterns and convert into structured insights',
        'Update skill memory and graph links',
        'Validate improvement with one measurable check',
      ],
    }));
  }
}
