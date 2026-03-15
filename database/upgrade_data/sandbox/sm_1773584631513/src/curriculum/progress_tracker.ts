import fs from 'node:fs';
import path from 'node:path';
import { SKILL_PROGRESS_DIR } from '../config.js';

interface ProgressStore {
  completed_tasks: Record<string, number>;
  metrics: Record<string, number>;
  updated_at: string;
}

const PROGRESS_FILE = path.join(SKILL_PROGRESS_DIR, 'curriculum_progress.json');

export class ProgressTracker {
  private read(): ProgressStore {
    if (!fs.existsSync(PROGRESS_FILE)) {
      return { completed_tasks: {}, metrics: {}, updated_at: new Date().toISOString() };
    }
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as ProgressStore;
    } catch {
      return { completed_tasks: {}, metrics: {}, updated_at: new Date().toISOString() };
    }
  }

  private write(data: ProgressStore): void {
    data.updated_at = new Date().toISOString();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  updateSkillCompletion(skillId: string, result: 'pass' | 'fail' | 'partial'): ProgressStore {
    const data = this.read();
    const delta = result === 'pass' ? 3 : result === 'partial' ? 1 : 0;
    data.completed_tasks[skillId] = (data.completed_tasks[skillId] || 0) + delta;
    this.write(data);
    return data;
  }

  trackProgress(metrics: Record<string, number>): ProgressStore {
    const data = this.read();
    for (const [key, value] of Object.entries(metrics || {})) {
      data.metrics[key] = Number(value || 0);
    }
    this.write(data);
    return data;
  }

  snapshot(): ProgressStore {
    return this.read();
  }
}
