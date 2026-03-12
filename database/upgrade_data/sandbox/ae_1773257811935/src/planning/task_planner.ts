import { GoalParser, type ParsedGoal } from './goal_parser.js';

export interface PlannedStep {
  id: string;
  title: string;
  objective: string;
  suggested_tool: string;
}

export interface StructuredTaskPlan {
  goal: ParsedGoal;
  steps: PlannedStep[];
}

export class TaskPlanningEngine {
  private readonly goalParser = new GoalParser();

  planGoal(goalText: string): StructuredTaskPlan {
    const goal = this.goalParser.parse(goalText);
    const steps: PlannedStep[] = [];

    const add = (title: string, objective: string, tool: string) => {
      steps.push({ id: `step_${steps.length + 1}`, title, objective, suggested_tool: tool });
    };

    add('Research and scope', 'Validate problem, users, and constraints.', 'web_lookup');

    if (goal.domain === 'product') {
      add('System architecture', 'Define backend/frontend/data architecture.', 'analyze');
      add('Backend implementation', 'Create API/services and persistence layer.', 'coding_skill');
      add('Frontend implementation', 'Build UI and integration flows.', 'coding_skill');
      add('Deployment plan', 'Define infra, CI/CD, and release checklist.', 'terminal_ops');
    } else if (goal.domain === 'coding') {
      add('Code structure', 'Create modules, interfaces, and error model.', 'analyze');
      add('Implementation', 'Develop core logic and tests.', 'coding_skill');
      add('Quality checks', 'Review performance/security/edge cases.', 'analyze');
    } else if (goal.domain === 'research') {
      add('Collect sources', 'Gather high-quality references and docs.', 'web_lookup');
      add('Synthesize findings', 'Compare options and tradeoffs.', 'analyze');
      add('Actionable recommendations', 'Convert findings into implementation steps.', 'doc_retrieve');
    } else {
      add('Task decomposition', 'Split goal into executable milestones.', 'analyze');
      add('Execution sequencing', 'Order steps and define dependencies.', 'doc_retrieve');
      add('Validation plan', 'Define checks and completion criteria.', 'analyze');
    }

    return { goal, steps };
  }
}
