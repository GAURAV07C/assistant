export type AgentIntent = 'chat' | 'coding' | 'docs' | 'realtime_search' | 'media';

export interface PlanStep {
  id: string;
  title: string;
  action: string;
  expected_output: string;
}

export interface AgentPlan {
  goal: string;
  steps: PlanStep[];
  tools: string[];
}

export class AgentController {
  detectIntent(input: string): AgentIntent {
    const text = String(input || '').toLowerCase();
    if (/(refactor|fix|bug|code|function|class)/.test(text)) return 'coding';
    if (/(doc|documentation|readme|api reference)/.test(text)) return 'docs';
    if (/(search|latest|news|today|realtime)/.test(text)) return 'realtime_search';
    if (/(image|video|audio|voice|3d)/.test(text)) return 'media';
    return 'chat';
  }

  buildPlan(goal: string, intent: AgentIntent): AgentPlan {
    return {
      goal,
      steps: [
        {
          id: '1',
          title: 'Analyze Request',
          action: `Classify request as ${intent} and collect context`,
          expected_output: 'Validated request context',
        },
        {
          id: '2',
          title: 'Execute Tooling',
          action: 'Route to selected tool chain with safety checks',
          expected_output: 'Structured result payload',
        },
        {
          id: '3',
          title: 'Summarize',
          action: 'Return concise output with next steps',
          expected_output: 'Actionable assistant response',
        },
      ],
      tools: ['chat', 'mentor', 'memory', 'audit'],
    };
  }
}
