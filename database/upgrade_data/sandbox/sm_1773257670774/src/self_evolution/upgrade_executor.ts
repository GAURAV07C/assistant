import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const PROPOSAL_FILE = path.join(UPGRADE_DATA_DIR, 'evolution_proposals.json');

export class UpgradeExecutor {
  publish(plan: { target: string; priority: string; actions: string[]; note: string }) {
    const all = this.read();
    const proposal = {
      id: `proposal_${Date.now()}`,
      ts: new Date().toISOString(),
      target: plan.target,
      priority: plan.priority,
      actions: plan.actions,
      note: plan.note,
      status: 'proposed',
    };
    const next = [proposal, ...all].slice(0, 120);
    fs.mkdirSync(path.dirname(PROPOSAL_FILE), { recursive: true });
    fs.writeFileSync(PROPOSAL_FILE, JSON.stringify(next, null, 2), 'utf8');
    return proposal;
  }

  recent(limit = 20) {
    return this.read().slice(0, Math.max(1, Math.min(100, limit)));
  }

  private read(): Array<Record<string, unknown>> {
    if (!fs.existsSync(PROPOSAL_FILE)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(PROPOSAL_FILE, 'utf8')) as unknown;
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    } catch {
      return [];
    }
  }
}
