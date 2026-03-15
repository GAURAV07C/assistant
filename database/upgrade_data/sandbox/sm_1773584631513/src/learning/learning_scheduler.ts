import fs from 'node:fs';
import {
  LEARNING_CURSOR_FILE,
} from '../config.js';
import { ResearchEngine } from '../research/research_engine.js';
import { DatasetManager, type ConversationRecord } from './dataset_manager.js';
import { BehaviorLearning } from './behavior_learning.js';
import { EmbeddingEngine } from './embedding_engine.js';
import { KnowledgeExtractor, type StructuredInsight } from './knowledge_extractor.js';
import { KnowledgeGraph } from './knowledge_graph.js';
import { MicroDatasetBuilder } from './micro_dataset_builder.js';
import { GapDetector } from '../meta_intelligence/gap_detector.js';
import { ImprovementEngine } from '../self_improvement/improvement_engine.js';
import { EvolutionPlanner } from '../self_evolution/evolution_planner.js';

interface CursorState {
  last_processed_ts: string;
}

export class LearningScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private readonly dataset = new DatasetManager();
  private readonly extractor = new KnowledgeExtractor();
  private readonly embedding = new EmbeddingEngine();
  private readonly graph = new KnowledgeGraph();
  private readonly behavior = new BehaviorLearning();
  private readonly research = new ResearchEngine();
  private readonly microDatasetBuilder = new MicroDatasetBuilder();
  private readonly gapDetector = new GapDetector();
  private readonly improvementEngine = new ImprovementEngine();
  private readonly evolutionPlanner = new EvolutionPlanner();

  storeConversation(record: ConversationRecord): void {
    this.dataset.store(record);
  }

  start(intervalHours = 3): void {
    const ms = Math.max(1, intervalHours) * 60 * 60 * 1000;
    this.stop();
    this.timer = setInterval(() => {
      void this.runCycle();
    }, ms);
    void this.runCycle();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const cursor = this.readCursor();
      const records = this.dataset.readSince(cursor.last_processed_ts, 4000);
      if (records.length === 0) return;

      const insights = this.extractor.extract(records);
      this.embedding.upsertInsights(insights);
      this.graph.updateFromInsights(insights);
      this.behavior.update(records);
      this.microDatasetBuilder.build(records, insights);

      await this.autonomousExpansion(insights);
      const gaps = this.gapDetector.detect();
      if (gaps.length) this.improvementEngine.generateFromGaps(gaps);
      this.evolutionPlanner.plan();
      this.writeCursor({ last_processed_ts: records[records.length - 1].timestamp });
    } catch (err) {
      console.warn(`[LEARNING] scheduler cycle failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async autonomousExpansion(insights: StructuredInsight[]): Promise<void> {
    const concepts = this.research.shouldExpand(insights);
    if (concepts.length === 0) return;
    const synthetic: StructuredInsight[] = [];
    for (const concept of concepts) {
      // eslint-disable-next-line no-await-in-loop
      const res = await this.research.expandConcept(concept);
      if (!res) continue;
      synthetic.push({
        timestamp: new Date().toISOString(),
        session_id: 'autonomous_research',
        kind: 'research_concept',
        topic: concept,
        summary: `${res.summary}\nSources: ${res.sources.join(', ')}`.slice(0, 1200),
        source_tags: ['autonomous_research', 'verified_web'],
      });
    }
    if (synthetic.length === 0) return;
    this.embedding.upsertInsights(synthetic);
    this.graph.updateFromInsights(synthetic);
    this.microDatasetBuilder.build([], synthetic);
  }

  private readCursor(): CursorState {
    if (!fs.existsSync(LEARNING_CURSOR_FILE)) {
      return { last_processed_ts: '' };
    }
    try {
      return JSON.parse(fs.readFileSync(LEARNING_CURSOR_FILE, 'utf8')) as CursorState;
    } catch {
      return { last_processed_ts: '' };
    }
  }

  private writeCursor(state: CursorState): void {
    fs.writeFileSync(LEARNING_CURSOR_FILE, JSON.stringify(state, null, 2), 'utf8');
  }
}
