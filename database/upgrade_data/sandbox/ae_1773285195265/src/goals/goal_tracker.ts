import { GoalRegistry } from './goal_registry.js';

export class GoalTracker {
  constructor(private readonly registry: GoalRegistry) {}

  trackFromMetrics(input: { avg_score: number; research_runs: number; debug_signal: number }) {
    const goals = this.registry.list();
    const coding = goals.find((g) => g.id === 'goal_coding_intelligence');
    const debugging = goals.find((g) => g.id === 'goal_debugging_mastery');
    const research = goals.find((g) => g.id === 'goal_research_depth');

    if (coding) this.registry.update(coding.id, Math.min(100, (coding.progress + (input.avg_score >= 75 ? 4 : 1))));
    if (debugging) this.registry.update(debugging.id, Math.min(100, (debugging.progress + (input.debug_signal >= 70 ? 4 : 1))));
    if (research) this.registry.update(research.id, Math.min(100, (research.progress + (input.research_runs > 0 ? 3 : 1))));

    return this.registry.list();
  }
}
