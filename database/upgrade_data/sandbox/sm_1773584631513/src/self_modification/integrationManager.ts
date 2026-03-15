import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';
import type { SelfModificationProposal } from './improvementPlanner.js';
import type { TestResult } from './testSandbox.js';

const HISTORY_FILE = path.join(UPGRADE_DATA_DIR, 'self_modification_history.json');

export interface IntegrationRecord {
  proposal_id: string;
  feature: string;
  sandbox_path: string;
  tests: TestResult;
  integrated_at: string;
  summary: string;
}

export class IntegrationManager {
  record(proposal: SelfModificationProposal, tests: TestResult, summary: string): IntegrationRecord {
    const record: IntegrationRecord = {
      proposal_id: proposal.id,
      feature: proposal.feature,
      sandbox_path: proposal.sandbox_path,
      tests,
      integrated_at: new Date().toISOString(),
      summary,
    };
    this.persist(record);
    return record;
  }

  history(): IntegrationRecord[] {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    try {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(raw) as IntegrationRecord[];
    } catch (err) {
      console.error('Unable to read integration history', err);
      return [];
    }
  }

  private persist(record: IntegrationRecord): void {
    const next = [record, ...this.history()].slice(0, 200);
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(next, null, 2), 'utf8');
  }
}
