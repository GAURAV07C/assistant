import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DATA_DIR } from '../config.js';
import type { EvaluationResult } from './response_evaluator.js';

export interface EvaluationLogEntry {
  timestamp: string;
  session_id: string;
  intent: string;
  routed_tools: string[];
  score: EvaluationResult;
}

const METRICS_FILE = path.join(EVAL_DATA_DIR, 'intelligence_metrics.jsonl');

export class PerformanceMetrics {
  record(entry: EvaluationLogEntry): void {
    fs.appendFileSync(METRICS_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  summary(limit = 200): {
    count: number;
    avg_final_score: number;
    avg_task_success: number;
  } {
    if (!fs.existsSync(METRICS_FILE)) {
      return { count: 0, avg_final_score: 0, avg_task_success: 0 };
    }
    const lines = fs.readFileSync(METRICS_FILE, 'utf8').split(/\r?\n/).filter(Boolean).slice(-limit);
    if (lines.length === 0) return { count: 0, avg_final_score: 0, avg_task_success: 0 };

    let finalTotal = 0;
    let successTotal = 0;
    let count = 0;
    for (const line of lines) {
      try {
        const item = JSON.parse(line) as EvaluationLogEntry;
        finalTotal += Number(item.score?.final_score || 0);
        successTotal += Number(item.score?.task_success || 0);
        count += 1;
      } catch {
        // ignore malformed lines
      }
    }
    if (count === 0) return { count: 0, avg_final_score: 0, avg_task_success: 0 };
    return {
      count,
      avg_final_score: Number((finalTotal / count).toFixed(2)),
      avg_task_success: Number((successTotal / count).toFixed(2)),
    };
  }
}
