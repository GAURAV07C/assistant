import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';
import { AutonomousKnowledgeBuilder } from './knowledge_builder.js';
import { TopicDetector } from './topic_detector.js';

const AUTONOMOUS_RESEARCH_FILE = path.join(UPGRADE_DATA_DIR, 'autonomous_research.json');

export interface ResearchCycleInput {
  message: string;
  tags?: string[];
  skillHints?: string[];
}

export interface ResearchCycleResult {
  ran: boolean;
  topics_detected: string[];
  built_topics: Array<{ topic: string; sources: number }>;
  timestamp: string;
}

export class ResearchScheduler {
  private readonly detector = new TopicDetector();
  private readonly builder = new AutonomousKnowledgeBuilder();

  async runCycle(input: ResearchCycleInput): Promise<ResearchCycleResult> {
    const topics = this.detector.detect(input);
    if (topics.length === 0) {
      return { ran: false, topics_detected: [], built_topics: [], timestamp: new Date().toISOString() };
    }

    const built: Array<{ topic: string; sources: number }> = [];
    for (const topic of topics) {
      // eslint-disable-next-line no-await-in-loop
      const data = await this.builder.build(topic);
      if (data) built.push({ topic: data.topic, sources: data.sources.length });
    }

    const result: ResearchCycleResult = {
      ran: true,
      topics_detected: topics,
      built_topics: built,
      timestamp: new Date().toISOString(),
    };

    this.persist(result);
    return result;
  }

  latest(): ResearchCycleResult | null {
    if (!fs.existsSync(AUTONOMOUS_RESEARCH_FILE)) return null;
    try {
      return JSON.parse(fs.readFileSync(AUTONOMOUS_RESEARCH_FILE, 'utf8')) as ResearchCycleResult;
    } catch {
      return null;
    }
  }

  private persist(result: ResearchCycleResult): void {
    fs.mkdirSync(path.dirname(AUTONOMOUS_RESEARCH_FILE), { recursive: true });
    fs.writeFileSync(AUTONOMOUS_RESEARCH_FILE, JSON.stringify(result, null, 2), 'utf8');
  }
}
