import type { FilteredInput } from './input_filter.js';

export type PolicyAction = 'normal' | 'research' | 'educational';

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
}

export class PolicyEngine {
  decide(input: FilteredInput, opts?: { preferResearch?: boolean }): PolicyDecision {
    if (input.category === 'risky' || input.risk_score >= 45) {
      return {
        action: 'educational',
        reason: 'Input matched risky or unsafe intent patterns.',
      };
    }

    if (opts?.preferResearch) {
      return {
        action: 'research',
        reason: 'Research preference enabled by route.',
      };
    }

    if (input.category === 'research') {
      return {
        action: 'research',
        reason: 'Input requires deeper analysis/research.',
      };
    }

    return {
      action: 'normal',
      reason: 'Standard safe request routed to primary model.',
    };
  }

  routeToBrain(input: FilteredInput, opts?: { preferResearch?: boolean }): PolicyDecision {
    return this.decide(input, opts);
  }
}
