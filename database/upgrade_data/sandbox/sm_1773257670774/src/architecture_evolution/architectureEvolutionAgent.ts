import path from 'node:path';
import { EvolutionAgent, AgentOutput, AgentTask } from '../agents/base_agent.js';
import { ArchitectureAnalyzer } from './architectureAnalyzer.js';
import { RefactorPlanner } from './refactorPlanner.js';
import { ArchitectureGenerator } from './architectureGenerator.js';
import { SandboxRefactorExecutor } from './sandboxRefactorExecutor.js';
import { ArchitectureValidator } from './architectureValidator.js';

export class ArchitectureEvolutionAgent implements EvolutionAgent {
  id = 'architecture_evolution_agent';
  private readonly analyzer = new ArchitectureAnalyzer();
  private readonly planner = new RefactorPlanner();
  private readonly generator = new ArchitectureGenerator();
  private readonly executor = new SandboxRefactorExecutor();
  private readonly validator = new ArchitectureValidator();

  supports(request: string): boolean {
    return request.toLowerCase().includes('architecture') || request.toLowerCase().includes('refactor');
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const workspaceRoot = path.resolve(process.cwd());
    const metrics = this.analyzer.analyze(workspaceRoot);
    const proposal = this.planner.plan(metrics);
    const architecturePlan = this.generator.generate(proposal);
    const sandboxPath = await this.executor.prepareSandbox(proposal);
    this.planner.markSandboxed(proposal.id);
    await this.executor.applyArchitecturePlan(sandboxPath, architecturePlan.summary);
    const validation = await this.validator.validate(sandboxPath, proposal);
    if (validation.success) {
      this.planner.markValidated(proposal.id);
    }

    const summaryLines = [
      `Architecture metrics: ${metrics.highComplexityModules.length} complex modules discovered.`,
      `Proposal: ${proposal.problem} → ${proposal.solution}.`,
      `Validation: ${validation.success ? 'passed' : 'failed'} (${validation.command}).`,
    ];

    return {
      agent: this.id,
      summary: summaryLines.join(' '),
      suggested_tools: ['architectureAnalyzer', 'sandboxRefactorExecutor'],
    };
  }
}
