import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const TASK_FILE = path.join(UPGRADE_DATA_DIR, 'task_memory.jsonl');

export interface TaskRecord {
  ts: string;
  request: string;
  intent: string;
  success: boolean;
  score: number;
  tools: string[];
  outcome: string;
}

export class TaskStore {
  add(record: TaskRecord): void {
    fs.mkdirSync(path.dirname(TASK_FILE), { recursive: true });
    fs.appendFileSync(TASK_FILE, `${JSON.stringify(record)}\n`, 'utf8');
  }

  recent(limit = 200): TaskRecord[] {
    if (!fs.existsSync(TASK_FILE)) return [];
    const lines = fs.readFileSync(TASK_FILE, 'utf8').split(/\r?\n/).filter(Boolean).slice(-limit);
    const out: TaskRecord[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as TaskRecord);
      } catch {
        // ignore
      }
    }
    return out;
  }
}
