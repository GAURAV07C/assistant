import type { EmbeddingEngine } from '../learning/embedding_engine.js';
import type { ResearchEngine } from '../research/research_engine.js';
import { IntentAnalyzer } from './intent_analyzer.js';
import { TaskPlanner } from './task_planner.js';
import { ReasoningBrainRouter } from './brain_router.js';

export interface ReasoningContext {
  intent: string;
  complexity: number;
  chosen_brain: 'brain_a' | 'brain_b' | 'hybrid';
  reason: string;
  planned_steps: string[];
  augmented_query: string;
}

export class ReasoningEngine {
  private readonly analyzer = new IntentAnalyzer();
  private readonly planner = new TaskPlanner();
  private readonly router = new ReasoningBrainRouter();

  constructor(
    private readonly embeddingEngine: EmbeddingEngine,
    private readonly researchEngine: ResearchEngine,
  ) {}

  async prepare(query: string): Promise<ReasoningContext> {
    const base = this.analyzer.analyze(query);
    const plan = this.planner.plan(base.intent, query);
    const brain = this.router.route({ intent: base.intent, complexity: base.complexity, needs_research: plan.needs_research });

    const memory = this.embeddingEngine.semanticRetrieve(query, 3);
    const memoryText = memory.map((m, idx) => `${idx + 1}. [${m.topic}] ${m.summary}`).join('\n');

    let researchText = '';
    if (plan.needs_research) {
      const r = await this.researchEngine.expandConcept(base.intent === 'research' ? query : base.intent);
      if (r) {
        researchText = `Research summary: ${r.summary}\nSources:\n${r.sources.join('\n')}`;
      }
    }

    const augmented = [
      `User query: ${query}`,
      `Intent: ${base.intent}, Complexity: ${base.complexity}`,
      `Planned steps:\n- ${plan.steps.join('\n- ')}`,
      memoryText ? `Relevant learned memory:\n${memoryText}` : '',
      researchText,
    ].filter(Boolean).join('\n\n');

    return {
      intent: base.intent,
      complexity: base.complexity,
      chosen_brain: brain.brain,
      reason: brain.reason,
      planned_steps: plan.steps,
      augmented_query: augmented,
    };
  }
}
