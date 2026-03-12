import path from 'node:path';
import type { RefactorProposal } from './refactorPlanner.js';
import { ArchitectureMetrics } from './architectureAnalyzer.js';

export interface GeneratedArchitecture {
  proposalId: string;
  folders: string[];
  modules: string[];
  dependencies: Array<{ from: string; to: string }>;
  summary: string;
}

export class ArchitectureGenerator {
  generate(proposal: RefactorProposal): GeneratedArchitecture {
    const base = path.relative(process.cwd(), 'ts-backend/src');
    const folders = [
      `${base}/core`,
      `${base}/agents`,
      `${base}/learning`,
      `${base}/tools`,
      `${base}/architecture_evolution`,
    ];
    const modules = ['architectureAnalyzer', 'refactorPlanner', 'architectureGenerator', 'sandboxRefactorExecutor', 'architectureValidator'];
    const dependencies = proposal.metrics.circularImports.map((circle) => ({ from: circle.from, to: circle.to }));
    return {
      proposalId: proposal.id,
      folders,
      modules,
      dependencies,
      summary: `Generated architecture map based on ${proposal.problem}: ${proposal.solution}`,
    };
  }
}
