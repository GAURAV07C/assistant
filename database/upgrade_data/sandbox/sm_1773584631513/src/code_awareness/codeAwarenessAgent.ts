import path from 'node:path';
import { EvolutionAgent, AgentOutput, AgentTask } from '../agents/base_agent.js';
import { RepoScanner } from './repoScanner.js';
import { FileAnalyzer } from './fileAnalyzer.js';
import { ArchitectureMapper } from './architectureMapper.js';
import { FeatureDetector } from './featureDetector.js';
import { CodeKnowledgeStore, KnowledgeSnapshot, ModuleKnowledge } from './codeKnowledgeStore.js';

export class CodeAwarenessAgent implements EvolutionAgent {
  id = 'code_awareness_agent';

  private readonly scanner = new RepoScanner();
  private readonly analyzer = new FileAnalyzer();
  private readonly mapper = new ArchitectureMapper();
  private readonly detector = new FeatureDetector();
  private readonly store = new CodeKnowledgeStore();

  supports(_request: string): boolean {
    return true;
  }

  async run(_task: AgentTask): Promise<AgentOutput> {
    const workspaceRoot = path.resolve(process.cwd());
    const scan = this.scanner.scan(workspaceRoot);
    const fileEntries = scan.tree.filter((entry) => entry.type === 'file');
    const filePaths = fileEntries.map((entry) => entry.path);
    const analysis = this.analyzer.analyze(filePaths, workspaceRoot);
    const graph = this.mapper.map(analysis, workspaceRoot);
    const features = this.detector.detect(analysis);
    const modules: ModuleKnowledge[] = analysis.map((item) => ({
      module: item.relative,
      files: [item.relative],
      features: [...new Set([...item.exports, ...item.apiRoutes])],
      status: 'implemented',
      summary: `${item.classes.length} classes / ${item.functions.length} functions / ${item.apiRoutes.length} routes`,
    }));

    const snapshot: KnowledgeSnapshot = {
      scanned_at: new Date().toISOString(),
      modules,
      graph,
      features,
      dependencies: scan.dependencies,
      devDependencies: scan.devDependencies,
      configs: scan.configs,
    };

    this.store.save(snapshot);

    const summary = `Code awareness mapped ${modules.length} modules, noted ${features.implemented.length} feature(s) and ${features.missing.length} gaps.`;
    return {
      agent: this.id,
      summary,
      suggested_tools: ['file_tools', 'vector_memory'],
    };
  }

  async refresh(): Promise<KnowledgeSnapshot> {
    await this.run({ request: 'refresh', context: {} });
    return this.store.read()!;
  }

  search(query: string) {
    return this.store.search(query);
  }

  latestSnapshot() {
    return this.store.read();
  }
}
