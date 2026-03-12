import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const GOALS_FILE = path.join(UPGRADE_DATA_DIR, 'long_term_goals.json');

export interface LongTermGoal {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in_progress' | 'completed';
  progress: number;
  created_at: string;
  updated_at: string;
}

export class GoalRegistry {
  private read(): LongTermGoal[] {
    if (!fs.existsSync(GOALS_FILE)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8')) as unknown;
      return Array.isArray(parsed) ? (parsed as LongTermGoal[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: LongTermGoal[]): void {
    fs.mkdirSync(path.dirname(GOALS_FILE), { recursive: true });
    fs.writeFileSync(GOALS_FILE, JSON.stringify(items, null, 2), 'utf8');
  }

  ensureDefaults(): LongTermGoal[] {
    const existing = this.read();
    if (existing.length > 0) return existing;
    const now = new Date().toISOString();
    const defaults: LongTermGoal[] = [
      { id: 'goal_coding_intelligence', title: 'Improve coding intelligence', description: 'Increase code quality and architecture reasoning depth.', status: 'in_progress', progress: 35, created_at: now, updated_at: now },
      { id: 'goal_debugging_mastery', title: 'Improve debugging skills', description: 'Reduce repeated failure patterns and improve fix quality.', status: 'in_progress', progress: 30, created_at: now, updated_at: now },
      { id: 'goal_research_depth', title: 'Improve research depth', description: 'Increase evidence-backed research quality and source linking.', status: 'planned', progress: 20, created_at: now, updated_at: now },
    ];
    this.write(defaults);
    return defaults;
  }

  list(): LongTermGoal[] {
    const all = this.read();
    if (!all.length) return this.ensureDefaults();
    return all;
  }

  update(goalId: string, progress: number, status?: LongTermGoal['status']): LongTermGoal | null {
    const all = this.list();
    const idx = all.findIndex((g) => g.id === goalId);
    if (idx < 0) return null;
    const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
    const nextStatus = status || (nextProgress >= 100 ? 'completed' : nextProgress > 0 ? 'in_progress' : 'planned');
    all[idx] = { ...all[idx], progress: nextProgress, status: nextStatus, updated_at: new Date().toISOString() };
    this.write(all);
    return all[idx];
  }
}
