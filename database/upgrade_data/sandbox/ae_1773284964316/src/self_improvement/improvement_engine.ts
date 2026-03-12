import { appendUpgradeRecord, readUpgradeRecords } from '../utils/upgradeStorage.js';
import { ReflectionReport } from '../meta_intelligence/reflection_engine.js';
import { MetaPerformanceMetric } from '../meta_intelligence/performance_analyzer.js';
import { KnowledgeGap } from '../meta_intelligence/gap_detector.js';

export interface ImprovementProposal {
  id: string;
  type: 'skill_upgrade' | 'tool_improvement' | 'knowledge_capture';
  target: string;
  description: string;
  source: string;
  impact: 'low' | 'medium' | 'high';
  created_at: string;
  status: 'pending';
}

export class ImprovementEngine {
  generateFromExecution(input: {
    reflection: ReflectionReport;
    performance: MetaPerformanceMetric;
    gap?: KnowledgeGap | null;
    request: string;
  }): ImprovementProposal | null {
    const { reflection, gap, performance, request } = input;
    const id = `improv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const impact = reflection.successScore < 60 ? 'high' : 'medium';
    const target = reflection.mistakeType === 'tool' ? 'tool_router' : 'coding_agent';
    const description = gap
      ? `Knowledge gap: ${gap.topic} (${gap.reason})`
      : reflection.improvementSuggestion;
    const proposal: ImprovementProposal = {
      id,
      type: reflection.mistakeType === 'tool' ? 'tool_improvement' : 'skill_upgrade',
      target,
      description: `${description} | request: ${request.slice(0, 160)}`.slice(0, 400),
      source: this.simplifySource(request),
      impact,
      created_at: new Date().toISOString(),
      status: 'pending',
    };
    appendUpgradeRecord('improvement_proposals.json', proposal);
    return proposal;
  }

  generateFromGaps(gaps: KnowledgeGap[]): ImprovementProposal[] {
    const created: ImprovementProposal[] = [];
    for (const gap of gaps) {
      const id = `improv_gap_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const proposal: ImprovementProposal = {
        id,
        type: 'knowledge_capture',
        target: gap.topic,
        description: `Fill knowledge gap detected from ${gap.detectedFromTask}`.slice(0, 400),
        source: gap.topic,
        impact: gap.priority === 'high' ? 'high' : 'medium',
        created_at: gap.timestamp,
        status: 'pending',
      };
      appendUpgradeRecord('improvement_proposals.json', proposal);
      created.push(proposal);
    }
    return created;
  }

  listPending(): ImprovementProposal[] {
    return readUpgradeRecords('improvement_proposals.json') as ImprovementProposal[];
  }

  private simplifySource(request: string): string {
    return request.split('\n')[0].trim().slice(0, 80);
  }
}
