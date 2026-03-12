import { DatasetManager } from './dataset_manager.js';
import { EmbeddingEngine } from './embedding_engine.js';
import { KnowledgeExtractor, type StructuredInsight } from './knowledge_extractor.js';
import { KnowledgeGraph } from './knowledge_graph.js';
import { BehaviorLearning } from './behavior_learning.js';
import { WebResearcher } from '../research/web_researcher.js';

export class ContinuousLearningEngine {
  private readonly dataset = new DatasetManager();
  private readonly extractor = new KnowledgeExtractor();
  private readonly embedding = new EmbeddingEngine();
  private readonly graph = new KnowledgeGraph();
  private readonly behavior = new BehaviorLearning();
  private readonly researcher = new WebResearcher();

  async ingestFromActivity(input: {
    timestamp: string;
    session_id: string;
    user_message: string;
    assistant_response: string;
    detected_topic: string;
    coding_context?: string;
    tags: string[];
  }): Promise<{ insights: number; researched: boolean; skill_categories: string[] }> {
    this.dataset.store(input);
    const records = this.dataset.readSince('', 120).slice(-40);
    const insights = this.extractor.extract(records);
    this.embedding.upsertInsights(insights);
    this.graph.updateFromInsights(insights);
    this.behavior.update(records.slice(-20));
    const skillCategories = this.detectSkillCategories(input.user_message, input.tags, insights.map((i) => i.topic));

    const shouldResearch = /\b(latest|trend|new framework|ai tool|compare)\b/i.test(input.user_message);
    if (!shouldResearch) return { insights: insights.length, researched: false, skill_categories: skillCategories };

    const research = await this.researcher.explore(input.user_message, 3);
    if (!research || research.sources.length === 0) return { insights: insights.length, researched: false, skill_categories: skillCategories };

    return { insights: insights.length, researched: true, skill_categories: skillCategories };
  }

  async ingestKnowledgeArtifact(input: {
    source: string;
    title: string;
    summary: string;
    tags: string[];
    timestamp?: string;
    topic?: string;
  }): Promise<void> {
    const timestamp = input.timestamp || new Date().toISOString();
    const insight: StructuredInsight = {
      timestamp,
      session_id: `learning:${input.source}`,
      kind: 'research_concept',
      topic: input.topic || 'learning',
      summary: input.summary,
      source_tags: input.tags,
    };
    this.embedding.upsertInsights([insight]);
    this.graph.updateFromInsights([insight]);
  }

  private detectSkillCategories(message: string, tags: string[], topics: string[]): string[] {
    const text = `${message} ${tags.join(' ')} ${topics.join(' ')}`.toLowerCase();
    const out = new Set<string>();
    if (/\b(code|typescript|react|api|backend|frontend)\b/.test(text)) out.add('coding');
    if (/\b(research|latest|compare|trend|document)\b/.test(text)) out.add('research');
    if (/\b(automation|script|pipeline|terminal|deploy)\b/.test(text)) out.add('automation');
    if (/\b(debug|bug|error|fix|exception)\b/.test(text)) out.add('analysis');
    if (/\b(plan|roadmap|productivity|workflow)\b/.test(text)) out.add('productivity');
    return Array.from(out);
  }
}
