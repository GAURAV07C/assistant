import type { AgentOutput, AgentTask, EvolutionAgent } from '../agents/base_agent.js';
import { RepoCrawler } from './repoCrawler.js';
import { CodeParser } from './codeParser.js';
import { ArchitectureAnalyzer } from './architectureAnalyzer.js';
import { PatternExtractor } from './patternExtractor.js';
import { VectorMemoryStore } from '../memory/vector_store.js';
import { ContinuousLearningEngine } from '../learning/continuous_learning_engine.js';
import { KnowledgeBuilder } from '../research/knowledge_builder.js';
import { appendLearningArtifact } from '../learning/learning_storage.js';
import { LearningStats } from '../learning/learning_stats.js';

export interface GithubKnowledge {
  repo: string;
  language: string;
  architecture: string;
  patterns: string[];
  folder_structure: string[];
  key_modules: string[];
  code_examples: string[];
  summary: string;
  detected_at: string;
}

export class GitHubLearningAgent implements EvolutionAgent {
  id = 'github_learning_agent';
  private readonly crawler = new RepoCrawler();
  private readonly parser = new CodeParser();
  private readonly archAnalyzer = new ArchitectureAnalyzer();
  private readonly patternExtractor = new PatternExtractor();
  private readonly vectorStore = new VectorMemoryStore();
  private readonly learningEngine = new ContinuousLearningEngine();
  private readonly knowledgeBuilder = new KnowledgeBuilder();
  private readonly stats = new LearningStats();

  supports(request: string): boolean {
    return /github\.com\//i.test(request);
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const repoUrl = this.extractUrl(task.request);
    if (!repoUrl) {
      return { agent: this.id, summary: 'GitHub URL missing.', suggested_tools: [] };
    }

    const repoInfo = await this.crawler.fetchRepo(repoUrl);
    if (!repoInfo) {
      return { agent: this.id, summary: 'Unable to fetch repository info.', suggested_tools: [] };
    }

    const interestingFiles = ['README.md', 'package.json', 'tsconfig.json'];
    const contentMap: Record<string, string> = {};
    for (const path of repoInfo.files) {
      if (interestingFiles.some((f) => path.toLowerCase().endsWith(f.toLowerCase()))) {
        const content = await this.crawler.fetchFile(repoInfo.owner, repoInfo.name, repoInfo.default_branch, path);
        if (content) contentMap[path] = content;
      }
    }

    const architecture = this.archAnalyzer.analyze(contentMap, repoInfo);
    const patterns = this.patternExtractor.extract(contentMap);
    const modules = this.parser.extractModules(contentMap);
    const apis = this.parser.detectApi(contentMap);
    const knowledge: GithubKnowledge = {
      repo: `${repoInfo.owner}/${repoInfo.name}`,
      language: repoInfo.language,
      architecture,
      patterns,
      folder_structure: repoInfo.files.slice(0, 10),
      key_modules: modules,
      code_examples: Object.values(contentMap).slice(0, 3).map((c) => c.slice(0, 200)),
      summary: `Detected ${modules.length} modules, ${apis.length} API mentions, architecture ${architecture}.`,
      detected_at: new Date().toISOString(),
    };

    const payload: Record<string, unknown> = { ...knowledge };
    appendLearningArtifact('github_knowledge.json', payload);
    this.vectorStore.upsert(`${knowledge.repo} ${knowledge.summary}`, {
      source: 'github',
      repo: knowledge.repo,
      architecture: knowledge.architecture,
    });
    await this.learningEngine.ingestKnowledgeArtifact({
      source: this.id,
      title: knowledge.repo,
      summary: knowledge.summary,
      tags: ['github', knowledge.language],
      topic: knowledge.language,
    });
    this.knowledgeBuilder.updateKnowledgeGraph([...knowledge.patterns, knowledge.architecture]);
    this.stats.record('github', repoUrl, knowledge.repo);

    return {
      agent: this.id,
      summary: `Captured GitHub repo ${knowledge.repo} with ${knowledge.patterns.length} patterns.`,
      suggested_tools: [],
    };
  }

  private extractUrl(text: string): string | null {
    const match = String(text || '').match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
    return match ? match[0] : null;
  }
}
