import type { AgentOutput, AgentTask, EvolutionAgent } from '../agents/base_agent.js';
import { ImageAnalyzer } from './imageAnalyzer.js';
import { CodeAnalyzer } from './codeAnalyzer.js';
import { MultimodalKnowledgeExtractor } from './multimodalKnowledgeExtractor.js';
import { VectorMemoryStore } from '../memory/vector_store.js';
import { ContinuousLearningEngine } from '../learning/continuous_learning_engine.js';
import { appendLearningArtifact } from '../learning/learning_storage.js';
import { LearningStats } from '../learning/learning_stats.js';

interface MultimodalPayload {
  type: 'image' | 'code' | 'diagram';
  content: string;
  title?: string;
}

export class MultimodalLearningAgent implements EvolutionAgent {
  id = 'multimodal_learning_agent';
  private readonly imageAnalyzer = new ImageAnalyzer();
  private readonly codeAnalyzer = new CodeAnalyzer();
  private readonly extractor = new MultimodalKnowledgeExtractor();
  private readonly vectorStore = new VectorMemoryStore();
  private readonly learningEngine = new ContinuousLearningEngine();
  private readonly stats = new LearningStats();

  supports(request: string): boolean {
    return /(image|diagram|screenshot|design)[\s\-]?analysis\b/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const payload = this.resolvePayload(task);
    if (!payload) {
      return { agent: this.id, summary: 'No multimodal payload found.', suggested_tools: [] };
    }
    const visual = this.imageAnalyzer.describe(payload.content);
    const code = this.codeAnalyzer.analyze(payload.content);
    const knowledge = this.extractor.extract({ type: payload.type, content: payload.title || payload.content, visual, code });

    const recordId = `mm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    appendLearningArtifact('multimodal_knowledge.json', {
      id: recordId,
      payload,
      ...knowledge,
      created: new Date().toISOString(),
    });
    this.vectorStore.upsert(`${knowledge.description} ${knowledge.summary}`, {
      source: 'multimodal',
      type: payload.type,
      title: payload.title || payload.type,
    });
    await this.learningEngine.ingestKnowledgeArtifact({
      source: this.id,
      title: payload.title || payload.type,
      summary: knowledge.summary,
      tags: ['multimodal', payload.type],
      topic: 'multimodal',
    });
    this.stats.record('multimodal', payload.type, recordId);

    return {
      agent: this.id,
      summary: `Captured multimodal asset (${payload.type}).`,
      suggested_tools: [],
    };
  }

  private resolvePayload(task: AgentTask): MultimodalPayload | null {
    const context = task.context?.multimodal;
    if (context && typeof context === 'object') {
      const { type, content, title } = context as MultimodalPayload;
      if (type && content) return { type, content, title };
    }
    try {
      const payload = JSON.parse(task.request || '{}') as MultimodalPayload;
      if (payload.type && payload.content) return payload;
    } catch {
      // ignore
    }
    return null;
  }
}
