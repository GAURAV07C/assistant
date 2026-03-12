import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';
const SELF_MOD_FILE = path.join(UPGRADE_DATA_DIR, 'self_modification_proposals.json');

export interface SelfModificationProposal {
  id: string;
  feature: string;
  reason: string;
  steps: string[];
  status: 'draft' | 'ready' | 'applied';
  created_at: string;
  sandbox_path: string;
}

export class ImprovementPlanner {
  plan(feature: string, reason: string, steps: string[] = []): SelfModificationProposal {
    const sanitizedSteps = steps.length ? steps : ['Analyze existing modules', 'Plan safe modifications', 'Document changes'];
    const proposal: SelfModificationProposal = {
      id: `sm_${Date.now()}`,
      feature: feature.trim() || 'undocumented improvement',
      reason: reason.trim() || 'automatic request',
      steps: sanitizedSteps,
      created_at: new Date().toISOString(),
      sandbox_path: '',
      status: 'draft',
    };

    this.persist(proposal);
    return proposal;
  }

  latest(): SelfModificationProposal | null {
    const list = this.loadAll();
    if (!list.length) return null;
    return list[list.length - 1];
  }

  markReady(id: string, sandboxPath: string): void {
    const proposals = this.loadAll().map((entry) => {
      if (entry.id === id) {
        return { ...entry, sandbox_path: sandboxPath, status: 'ready' as const };
      }
      return entry;
    });
    this.persistAll(proposals);
  }

  private loadAll(): SelfModificationProposal[] {
    if (!fs.existsSync(SELF_MOD_FILE)) return [];
    try {
      const raw = fs.readFileSync(SELF_MOD_FILE, 'utf8');
      return JSON.parse(raw) as SelfModificationProposal[];
    } catch (err) {
      console.error('Unable to load self modification proposals', err);
      return [];
    }
  }

  private persist(proposal: SelfModificationProposal): void {
    const list = [...this.loadAll(), proposal];
    this.persistAll(list);
  }

  private persistAll(proposals: SelfModificationProposal[]): void {
    fs.mkdirSync(path.dirname(SELF_MOD_FILE), { recursive: true });
    fs.writeFileSync(SELF_MOD_FILE, JSON.stringify(proposals, null, 2), 'utf8');
  }
}
