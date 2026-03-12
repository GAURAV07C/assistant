import type { TaskRecord } from './task_store.js';

export class TaskReuse {
  suggest(request: string, records: TaskRecord[]) {
    const q = String(request || '').toLowerCase();
    const matched = records
      .filter((r) => r.success && q.split(/\s+/).some((w) => w.length > 3 && r.request.toLowerCase().includes(w)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ request: r.request.slice(0, 140), tools: r.tools, score: r.score, outcome: r.outcome.slice(0, 200) }));

    return {
      reuse_candidates: matched,
      can_reuse: matched.length > 0,
    };
  }
}
