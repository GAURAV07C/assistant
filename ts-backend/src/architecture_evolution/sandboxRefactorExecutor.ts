import path from 'node:path';
import { RepoCloner } from '../self_modification/repoCloner.js';
import type { RefactorProposal } from './refactorPlanner.js';

const SANDBOX_ROOT = path.join(path.dirname(path.resolve(process.cwd(), '../database')), 'upgrade_data', 'architecture_sandbox');

export class SandboxRefactorExecutor {
  private readonly cloner = new RepoCloner();

  async prepareSandbox(proposal: RefactorProposal): Promise<string> {
    const sandboxPath = await this.cloner.cloneSandbox(proposal.id);
    return sandboxPath;
  }

  async applyArchitecturePlan(sandboxPath: string, planSummary: string): Promise<void> {
    const summaryPath = path.join(sandboxPath, 'ARCHITECTURE_EVOLUTION.md');
    await import('node:fs/promises').then(async (fs) => {
      await fs.writeFile(summaryPath, `# Architecture Evolution\n\n${planSummary}\n`, 'utf8');
    });
  }
}
