import { ResearchEngine } from '../research/research_engine.js';

export interface ResearchKnowledge {
  topic: string;
  summary: string;
  sources: string[];
}

export class AutonomousKnowledgeBuilder {
  private readonly research = new ResearchEngine();

  async build(topic: string): Promise<ResearchKnowledge | null> {
    const found = await this.research.autonomousWebSearch(topic);
    if (!found) return null;
    return {
      topic,
      summary: found.summary,
      sources: found.sources,
    };
  }
}
