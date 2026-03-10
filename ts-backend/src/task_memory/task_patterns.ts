import type { TaskRecord } from './task_store.js';

export class TaskPatterns {
  detect(records: TaskRecord[]) {
    const byIntent = new Map<string, number>();
    const byTool = new Map<string, number>();

    for (const r of records) {
      byIntent.set(r.intent, (byIntent.get(r.intent) || 0) + 1);
      for (const t of r.tools || []) byTool.set(t, (byTool.get(t) || 0) + 1);
    }

    return {
      top_intents: Array.from(byIntent.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
      top_tools: Array.from(byTool.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }
}
