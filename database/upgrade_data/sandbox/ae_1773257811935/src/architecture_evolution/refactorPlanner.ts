import { ArchitectureMetrics } from './architectureAnalyzer.js';
import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const PROPOSALS_FILE = path.join(UPGRADE_DATA_DIR, 'architecture_proposals.json');

export interface RefactorProposal {
  id: string;
  problem: string;
  solution: string;
  priority: 'low' | 'medium' | 'high';
  impact_estimate: string;
  metrics: ArchitectureMetrics;
  created_at: string;
  status: 'draft' | 'sandboxed' | 'validated';
}

export class RefactorPlanner {
  plan(metrics: ArchitectureMetrics): RefactorProposal {
    const problems: Array<{ problem: string; solution: string; priority: 'low' | 'medium' | 'high'; impact: string }> = [];
    if (metrics.highComplexityModules.length) {
      problems.push({
        problem: 'High complexity modules detected',
        solution: 'Split modules with >20 members into submodules and abstract shared logic',
        priority: 'high',
        impact: 'Improved maintainability',
      });
    }
    if (metrics.oversizedFiles.length) {
      problems.push({
        problem: 'Oversized files found',
        solution: 'Break files larger than ~50k characters into smaller responsibilities',
        priority: 'medium',
        impact: 'Faster builds and readability',
      });
    }
    if (!problems.length) {
      problems.push({
        problem: 'Architecture seems stable',
        solution: 'Monitor for drift and consider incremental modularization',
        priority: 'low',
        impact: 'Continuous health check',
      });
    }

    const chosen = problems[0];
    const proposal: RefactorProposal = {
      id: `ae_${Date.now()}`,
      problem: chosen.problem,
      solution: chosen.solution,
      priority: chosen.priority,
      impact_estimate: chosen.impact,
      metrics,
      created_at: new Date().toISOString(),
      status: 'draft',
    };
    this.persist(proposal);
    return proposal;
  }

  markSandboxed(id: string): void {
    this.updateStatus(id, 'sandboxed');
  }

  markValidated(id: string): void {
    this.updateStatus(id, 'validated');
  }

  latest(): RefactorProposal | null {
    const list = this.readAll();
    return list.length ? list[list.length - 1] : null;
  }

  private readAll(): RefactorProposal[] {
    if (!fs.existsSync(PROPOSALS_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf8')) as RefactorProposal[];
    } catch (err) {
      console.error('Failed to read architecture proposals', err);
      return [];
    }
  }

  private persist(proposal: RefactorProposal): void {
    const list = [...this.readAll(), proposal];
    fs.mkdirSync(path.dirname(PROPOSALS_FILE), { recursive: true });
    fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(list, null, 2), 'utf8');
  }

  private updateStatus(id: string, status: RefactorProposal['status']): void {
    const updated = this.readAll().map((item) => (item.id === id ? { ...item, status } : item));
    fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(updated, null, 2), 'utf8');
  }
}
