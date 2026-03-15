import { readUpgradeRecords, appendUpgradeRecord } from '../utils/upgradeStorage.js';
import type { ImprovementProposal } from '../self_improvement/improvement_engine.js';

export interface EvolutionPlan {
  proposalId: string;
  impact: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  upgradeType: 'architecture' | 'skill' | 'tool';
  created_at: string;
}

export interface EvolutionContext {
  weaknesses?: string[];
  optimizer_suggestions?: unknown;
  health?: string;
}

export class EvolutionPlanner {
  plan(_context?: EvolutionContext): EvolutionPlan[] {
    const proposals = readUpgradeRecords<ImprovementProposal>('improvement_proposals.json').filter((p) => p.status === 'pending');
    if (proposals.length === 0) return [];
    const plans: EvolutionPlan[] = proposals.slice(-5).map((proposal) => {
      const impact = proposal.impact;
      const risk = impact === 'high' ? 'medium' : 'low';
      const upgradeType = proposal.type === 'tool_improvement' ? 'tool' : proposal.type === 'skill_upgrade' ? 'skill' : 'architecture';
      const plan: EvolutionPlan = {
        proposalId: proposal.id,
        impact,
        risk,
        upgradeType,
        created_at: new Date().toISOString(),
      };
      appendUpgradeRecord('evolution_plans.json', plan);
      return plan;
    });
    return plans;
  }
}
