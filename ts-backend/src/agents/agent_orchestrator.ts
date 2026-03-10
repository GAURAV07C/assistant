import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';
import type { AgentOutput, EvolutionAgent } from './base_agent.js';
import { AutomationAgent } from './automation_agent.js';
import { CodingAgent } from './coding_agent.js';
import { DebugAgent } from './debug_agent.js';
import { EvaluationAgent } from './evaluation_agent.js';
import { LearningAgent } from './learning_agent.js';
import { PlanningAgent } from './planning_agent.js';
import { ResearchAgent } from './research_agent.js';

const ACTIVITY_FILE = path.join(UPGRADE_DATA_DIR, 'agent_activity.json');

export interface OrchestratedResult {
  task_id: string;
  plan: string[];
  assignments: Array<{ step: string; agent: string }>;
  outputs: AgentOutput[];
  active_agents: string[];
  final_summary: string;
}

interface AgentActivity {
  ts: string;
  task_id: string;
  request: string;
  active_agents: string[];
  step_count: number;
}

export class AgentOrchestrator {
  private readonly planningAgent = new PlanningAgent();
  private readonly researchAgent = new ResearchAgent();
  private readonly codingAgent = new CodingAgent();
  private readonly debugAgent = new DebugAgent();
  private readonly learningAgent = new LearningAgent();
  private readonly automationAgent = new AutomationAgent();
  private readonly evaluationAgent = new EvaluationAgent();

  private readonly agents: EvolutionAgent[] = [
    this.researchAgent,
    this.codingAgent,
    this.debugAgent,
    this.planningAgent,
    this.learningAgent,
    this.automationAgent,
  ];

  async route(request: string, context?: Record<string, unknown>): Promise<AgentOutput[]> {
    const orchestrated = await this.orchestrate(request, context);
    return orchestrated.outputs;
  }

  async orchestrate(request: string, context?: Record<string, unknown>): Promise<OrchestratedResult> {
    const taskId = `task_${Date.now()}`;
    const plan = this.planningAgent.decompose(request);
    const assignments = this.assignSteps(plan);

    const outputs: AgentOutput[] = [];
    const activeAgentSet = new Set<string>(['planning_agent']);

    for (const a of assignments) {
      const agent = this.resolveAgent(a.agent);
      if (!agent) continue;
      activeAgentSet.add(agent.id);
      // eslint-disable-next-line no-await-in-loop
      const out = await agent.run({ request: `${request}\nStep: ${a.step}`, context });
      outputs.push(out);
    }

    const qualitySignals = outputs.map((o) => `${o.agent}:${o.suggested_tools.join(',')}`).join(' | ');
    const evaluation = await this.evaluationAgent.run({
      request,
      context: { ...(context || {}), quality_signals: qualitySignals },
    });
    outputs.push(evaluation);
    activeAgentSet.add(this.evaluationAgent.id);

    const activeAgents = Array.from(activeAgentSet);
    const finalSummary = [
      `Orchestrated ${assignments.length} subtask(s) for request.`,
      `Agents: ${activeAgents.join(', ')}`,
      `Evaluation: ${evaluation.summary}`,
    ].join(' ');

    this.recordActivity({
      ts: new Date().toISOString(),
      task_id: taskId,
      request: request.slice(0, 400),
      active_agents: activeAgents,
      step_count: assignments.length,
    });

    return {
      task_id: taskId,
      plan,
      assignments,
      outputs,
      active_agents: activeAgents,
      final_summary: finalSummary,
    };
  }

  listAgentIds(): string[] {
    return [
      this.planningAgent.id,
      this.researchAgent.id,
      this.codingAgent.id,
      this.debugAgent.id,
      this.learningAgent.id,
      this.automationAgent.id,
      this.evaluationAgent.id,
    ];
  }

  recentActivity(limit = 20): AgentActivity[] {
    const items = this.readActivity();
    return items.slice(0, Math.max(1, Math.min(100, limit)));
  }

  private assignSteps(steps: string[]): Array<{ step: string; agent: string }> {
    return steps.map((step) => ({
      step,
      agent: this.pickAgentForStep(step),
    }));
  }

  private pickAgentForStep(step: string): string {
    const text = step.toLowerCase();
    if (/research|compare|documentation|trend/.test(text)) return this.researchAgent.id;
    if (/bug|error|failure|fix|debug/.test(text)) return this.debugAgent.id;
    if (/learn|skill|roadmap|curriculum/.test(text)) return this.learningAgent.id;
    if (/deploy|pipeline|automate|script|terminal|git/.test(text)) return this.automationAgent.id;
    return this.codingAgent.id;
  }

  private resolveAgent(id: string): EvolutionAgent | null {
    return this.agents.find((a) => a.id === id) || null;
  }

  private readActivity(): AgentActivity[] {
    if (!fs.existsSync(ACTIVITY_FILE)) return [];
    try {
      const raw = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8')) as unknown;
      return Array.isArray(raw) ? (raw as AgentActivity[]) : [];
    } catch {
      return [];
    }
  }

  private recordActivity(entry: AgentActivity): void {
    const next = [entry, ...this.readActivity()].slice(0, 200);
    fs.mkdirSync(path.dirname(ACTIVITY_FILE), { recursive: true });
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(next, null, 2), 'utf8');
  }
}
