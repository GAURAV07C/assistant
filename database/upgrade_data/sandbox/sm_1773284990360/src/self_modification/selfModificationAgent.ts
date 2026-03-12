import { EvolutionAgent, AgentOutput, AgentTask } from '../agents/base_agent.js';
import { ImprovementPlanner } from './improvementPlanner.js';
import { RepoCloner } from './repoCloner.js';
import { CodeModifier } from './codeModifier.js';
import { TestSandbox } from './testSandbox.js';
import { IntegrationManager } from './integrationManager.js';

export class SelfModificationAgent implements EvolutionAgent {
  id = 'self_modification_agent';
  private readonly planner = new ImprovementPlanner();
  private readonly cloner = new RepoCloner();
  private readonly modifier = new CodeModifier();
  private readonly tester = new TestSandbox();
  private readonly integrator = new IntegrationManager();

  supports(request: string): boolean {
    return request.toLowerCase().includes('upgrade') || request.toLowerCase().includes('self') || request.toLowerCase().includes('improve');
  }

  async run(task: AgentTask): Promise<AgentOutput> {
    const reason = String(task.context?.reason || 'manual upgrade request');
    const steps = (task.context?.steps as string[]) || [];
    const proposal = this.planner.plan(task.request, reason, steps);
    const sandboxPath = await this.cloner.cloneSandbox(proposal.id);
    this.planner.markReady(proposal.id, sandboxPath);

    await this.modifier.apply(sandboxPath, [
      {
        relativePath: 'SELF_MODIFICATION_PLAN.md',
        content: `# ${proposal.feature}\n\nReason: ${proposal.reason}\nSteps:\n${proposal.steps.map((step) => `- ${step}`).join('\n')}\n`,
      },
    ]);

    const testResult = await this.tester.runChecks(sandboxPath, { runTests: Boolean(task.context?.runTests) });
    const summaryLines = [
      `Plan recorded for ${proposal.feature}.`,
      testResult.skipped ? 'Tests skipped (dry run).' : testResult.success ? 'Tests passed in sandbox.' : `Tests failed: ${testResult.error || 'see logs'}.`,
    ];

    const summary = summaryLines.join(' ');
    this.integrator.record(proposal, testResult, summary);

    return {
      agent: this.id,
      summary,
      suggested_tools: ['self_modification_agent'],
    };
  }
}
