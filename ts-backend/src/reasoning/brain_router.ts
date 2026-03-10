import type { ReasoningIntent } from './intent_analyzer.js';

export type ReasoningBrain = 'brain_a' | 'brain_b' | 'hybrid';

export class ReasoningBrainRouter {
  route(input: { intent: ReasoningIntent; complexity: number; needs_research: boolean }): { brain: ReasoningBrain; reason: string } {
    if (input.needs_research) return { brain: 'brain_b', reason: 'Research needed for this query.' };
    if (input.intent === 'architecture' || input.intent === 'complex_problem') return { brain: 'brain_b', reason: 'Complex/architecture intent.' };
    if (input.complexity >= 75) return { brain: 'hybrid', reason: 'High complexity; use deep reasoning with fallback.' };
    return { brain: 'brain_a', reason: 'Simple/fast query path.' };
  }
}
