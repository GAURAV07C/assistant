import { appendUpgradeRecord } from '../utils/upgradeStorage.js';

export interface MetaPerformanceMetric {
  timestamp: string;
  latencyMs: number;
  llmCalls: number;
  agentSuccessRate: number;
  toolSuccessRate: number;
  evaluationScore: number;
}

export class MetaPerformanceAnalyzer {
  record(input: MetaPerformanceMetric): MetaPerformanceMetric {
    appendUpgradeRecord('performance_metrics.json', input);
    return input;
  }
}
