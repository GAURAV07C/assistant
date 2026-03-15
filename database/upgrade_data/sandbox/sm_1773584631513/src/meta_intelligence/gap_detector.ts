import { TaskStore, type TaskRecord } from '../task_memory/task_store.js';
import { appendUpgradeRecord, readUpgradeRecords } from '../utils/upgradeStorage.js';

export interface KnowledgeGap {
  topic: string;
  priority: 'low' | 'medium' | 'high';
  detectedFromTask: string;
  reason: string;
  timestamp: string;
}

export class GapDetector {
  private readonly store = new TaskStore();

  recordTask(record: TaskRecord): KnowledgeGap | null {
    const failure = !record.success || record.score < 65;
    if (!failure) return null;
    const topic = this.detectTopic(record.request);
    const gap: KnowledgeGap = {
      topic,
      priority: record.score < 50 ? 'high' : 'medium',
      detectedFromTask: record.request.slice(0, 260),
      reason: `score ${record.score}`,
      timestamp: new Date().toISOString(),
    };
    appendUpgradeRecord('knowledge_gaps.json', gap);
    return gap;
  }

  detect(): KnowledgeGap[] {
    const records = readUpgradeRecords<KnowledgeGap>('knowledge_gaps.json');
    return records.map((r) => r as KnowledgeGap).slice(-20);
  }

  private detectTopic(request: string): string {
    const lower = request.toLowerCase();
    if (lower.includes('typescript') || lower.includes('tsconfig')) return 'advanced typescript';
    if (lower.includes('architecture')) return 'system architecture';
    if (lower.includes('deployment') || lower.includes('docker')) return 'devops';
    return 'general engineering';
  }
}
