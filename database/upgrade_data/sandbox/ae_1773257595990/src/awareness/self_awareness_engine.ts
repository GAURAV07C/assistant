import { AwarenessStateStore, type AwarenessState } from './awareness_state.js';
import { CuriosityEngine } from './curiosity_engine.js';
import { KnowledgeGapDetector } from './knowledge_gap_detector.js';
import { QuestionGenerator } from './question_generator.js';

export interface AwarenessInput {
  request: string;
  response: string;
  known_concepts: string[];
  research_topics?: string[];
  recent_quality_score: number;
}

export class SelfAwarenessEngine {
  private readonly store = new AwarenessStateStore();
  private readonly gapDetector = new KnowledgeGapDetector();
  private readonly curiosity = new CuriosityEngine();
  private readonly questionGen = new QuestionGenerator();

  evaluate(input: AwarenessInput): AwarenessState {
    const prev = this.store.read();
    const knowledgeGaps = this.gapDetector.detect({
      request: input.request,
      response: input.response,
      knownConcepts: input.known_concepts,
      researchTopics: input.research_topics || [],
    });

    const curiosity = this.curiosity.decide({
      knowledge_gaps: knowledgeGaps,
      recent_quality_score: input.recent_quality_score,
    });

    const questions = this.questionGen.generate(knowledgeGaps);

    const next: AwarenessState = {
      updated_at: new Date().toISOString(),
      curiosity_score: curiosity.curiosity_score,
      known_concepts: Array.from(new Set([...(prev.known_concepts || []), ...input.known_concepts])).slice(-150),
      knowledge_gaps: knowledgeGaps,
      generated_questions: questions,
      active_learning_focus: curiosity.learning_focus,
    };

    this.store.write(next);
    return next;
  }

  latest(): AwarenessState {
    return this.store.read();
  }
}
