import type { AgentOutput, AgentTask, EvolutionAgent } from '../agents/base_agent.js';
import { WebCrawler } from './crawler.js';
import { HtmlParser } from './htmlParser.js';
import { KnowledgeExtractor } from './knowledgeExtractor.js';
import { VectorMemoryStore } from '../memory/vector_store.js';
import { ContinuousLearningEngine } from '../learning/continuous_learning_engine.js';
import { appendLearningArtifact } from '../learning/learning_storage.js';
import { LearningStats } from '../learning/learning_stats.js';
import { KnowledgeBuilder } from '../research/knowledge_builder.js';

export class WebLearningAgent implements EvolutionAgent {
  id = 'web_learning_agent';
  private readonly crawler = new WebCrawler();
  private readonly parser = new HtmlParser();
  private readonly extractor = new KnowledgeExtractor();
  private readonly vectorStore = new VectorMemoryStore();
  private readonly learningEngine = new ContinuousLearningEngine();
  private readonly stats = new LearningStats();
  private readonly knowledgeBuilder = new KnowledgeBuilder();

  supports(request: string): boolean {
    return /(doc|docs|documentation|blog|guide|tutorial|learn)/i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const url = this.findUrl(task.request);
    if (!url) {
      return { agent: this.id, summary: 'No documentation URL provided.', suggested_tools: [] };
    }

    try {
      const html = await this.crawler.fetchPage(url);
      const title = this.titleFromHtml(html) || `page ${url}`;
      const text = this.parser.extractText(html);
      const sections = this.parser.extractSections(html);
      const codeExamples = this.parser.extractCode(html);
      const knowledge = this.extractor.extract(url, title, sections, text, codeExamples);

      const artifactId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      appendLearningArtifact('web_knowledge.json', {
        id: artifactId,
        source_url: url,
        ...knowledge,
        learned_at: new Date().toISOString(),
      });
      this.vectorStore.upsert(`${title} ${knowledge.summary}`, {
        source: 'web',
        url,
        type: 'web',
        title,
      });
      await this.learningEngine.ingestKnowledgeArtifact({
        source: this.id,
        title,
        summary: knowledge.summary,
        tags: ['documentation', 'web'],
        topic: knowledge.concepts[0] || 'documentation',
      });
      this.knowledgeBuilder.updateKnowledgeGraph(knowledge.concepts);
      this.stats.record('web', url, artifactId);
      console.log(`[WebLearningAgent] Captured ${url}`);

      return {
        agent: this.id,
        summary: `Indexed documentation: ${title} (${knowledge.concepts.length} concepts).`,
        suggested_tools: [],
      };
    } catch (err) {
      console.warn('[WebLearningAgent] crawl error', err);
      return { agent: this.id, summary: `Failed to crawl ${url}: ${String(err)}`, suggested_tools: [] };
    }
  }

  private findUrl(text: string): string | null {
    const match = String(text || '').match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
    return match ? match[0] : null;
  }

  private titleFromHtml(html: string): string | null {
    const match = html.match(/<title>(.*?)<\/title>/i);
    return match ? match[1].trim() : null;
  }
}
