import type { TaskRecord } from './task_store.js';

export class TaskSuccessRate {
  evaluate(records: TaskRecord[]) {
    if (!records.length) return { total: 0, success_rate: 0, avg_score: 0 };
    const ok = records.filter((r) => r.success).length;
    const avg = records.reduce((a, b) => a + Number(b.score || 0), 0) / records.length;
    return {
      total: records.length,
      success_rate: Number((ok / records.length).toFixed(2)),
      avg_score: Number(avg.toFixed(2)),
    };
  }
}
