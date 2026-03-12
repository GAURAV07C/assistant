import type { AgentOutput, AgentTask, EvolutionAgent } from '../agents/base_agent.js';
import { YouTubeCrawler } from './youtubeCrawler.js';
import { TranscriptExtractor } from './transcriptExtractor.js';
import { VideoKnowledgeExtractor } from './videoKnowledgeExtractor.js';
import { VectorMemoryStore } from '../memory/vector_store.js';
import { ContinuousLearningEngine } from '../learning/continuous_learning_engine.js';
import { appendLearningArtifact } from '../learning/learning_storage.js';
import { LearningStats } from '../learning/learning_stats.js';

export class YouTubeLearningAgent implements EvolutionAgent {
  id = 'youtube_learning_agent';
  private readonly crawler = new YouTubeCrawler();
  private readonly extractor = new TranscriptExtractor();
  private readonly knowledgeExtractor = new VideoKnowledgeExtractor();
  private readonly vectorStore = new VectorMemoryStore();
  private readonly learningEngine = new ContinuousLearningEngine();
  private readonly stats = new LearningStats();

  supports(request: string): boolean {
    return /(youtube|video|tutorial)/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const url = this.extractUrl(task.request);
    if (!url) {
      return { agent: this.id, summary: 'No YouTube URL provided for learning.' , suggested_tools: [] };
    }

    const transcript = await this.crawler.fetchTranscript(url);
    const cleaned = this.extractor.normalize(transcript.transcript);
    const knowledge = this.knowledgeExtractor.extract({ title: transcript.title, channel: transcript.channel }, this.extractor.toParagraphs(cleaned));

    const artifactId = `yt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    appendLearningArtifact('youtube_knowledge.json', {
      id: artifactId,
      url,
      ...knowledge,
      learned_at: new Date().toISOString(),
    });
    this.vectorStore.upsert(`${knowledge.video_title} ${knowledge.summary}`, {
      source: 'youtube',
      url,
      type: 'video',
      title: knowledge.video_title,
      channel: knowledge.channel,
    });
    await this.learningEngine.ingestKnowledgeArtifact({
      source: this.id,
      title: knowledge.video_title,
      summary: knowledge.summary,
      tags: ['youtube', 'video'],
    });
    this.stats.record('youtube', url, artifactId);
    console.log(`[YouTubeLearningAgent] Learned ${knowledge.video_title} from ${url}`);

    return {
      agent: this.id,
      summary: `Learned video: ${knowledge.video_title} (${knowledge.concepts.length} concepts).`,
      suggested_tools: [],
    };
  }

  private extractUrl(request: string): string | null {
    const match = String(request || '').match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
    return match ? match[0] : null;
  }
}
