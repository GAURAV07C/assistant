import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DATA_DIR } from '../../config.js';

const REVIEW_FILE = path.join(EVAL_DATA_DIR, 'reflection_review_logs.jsonl');

export class ReflectionReviewLogs {
  append(entry: Record<string, unknown>): void {
    fs.appendFileSync(REVIEW_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  recent(limit = 50): Record<string, unknown>[] {
    if (!fs.existsSync(REVIEW_FILE)) return [];
    const lines = fs.readFileSync(REVIEW_FILE, 'utf8').split(/\r?\n/).filter(Boolean).slice(-limit);
    const out: Record<string, unknown>[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // ignore malformed lines
      }
    }
    return out.reverse();
  }
}
