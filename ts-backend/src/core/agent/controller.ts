import type { AuditService } from '../safety/auditService.js';
import type { SafetyService, SafetyActionType } from '../safety/safetyService.js';
import type { MemoryService } from '../memory/memoryService.js';
import type { ChatService } from '../../services/chatService.js';
import { PerformanceMetrics } from '../../evaluation/performance_metrics.js';
import { ResponseEvaluator } from '../../evaluation/response_evaluator.js';
import { KnowledgeCompressor } from '../../knowledge/knowledge_compressor.js';
import { StepExecutor } from '../../planning/step_executor.js';
import { TaskPlanningEngine } from '../../planning/task_planner.js';
import { KnowledgeBuilder } from '../../research/knowledge_builder.js';
import { SkillSystem } from '../../skills/skill_system.js';
import { SkillTracker } from '../../skills/skill_tracker.js';
import { SkillEngine } from '../../skills/skill_engine.js';
import { TrainingDatasetBuilder } from '../../training/dataset_builder.js';
import { MicroModelTrainer } from '../../training/micro_model_trainer.js';
import { FileTools } from '../../tools/file_tools.js';
import { GitTools } from '../../tools/git_tools.js';
import { TerminalTools } from '../../tools/terminal_tools.js';
import { WebTools } from '../../tools/web_tools.js';
import { ReflectionEngine } from '../self_reflection/reflection_engine.js';
import { CurriculumEngine } from '../../curriculum/curriculum_engine.js';
import { AgentOrchestrator } from '../../agents/agent_orchestrator.js';
import { IntelligenceGraph } from '../../intelligence/intelligence_graph.js';
import { ContinuousLearningEngine } from '../../learning/continuous_learning_engine.js';
import { MetaController } from '../../meta_intelligence/meta_controller.js';
import { ResearchScheduler } from '../../autonomous_research/research_scheduler.js';
import { PerformanceAnalyzer } from '../../self_improvement/performance_analyzer.js';
import { MistakeDetector } from '../../self_improvement/mistake_detector.js';
import { ImprovementPlanner } from '../../self_improvement/improvement_planner.js';
import { SelfAwarenessEngine } from '../../awareness/self_awareness_engine.js';
import { VectorMemoryStore } from '../../memory/vector_store.js';
import { SemanticSearch } from '../../memory/semantic_search.js';
import { RetrievalEngine } from '../../memory/retrieval_engine.js';
import { ContextBuilder } from '../../memory/context_builder.js';
import { GoalRegistry } from '../../goals/goal_registry.js';
import { GoalScheduler } from '../../goals/goal_scheduler.js';
import { GoalTracker } from '../../goals/goal_tracker.js';
import { GoalEvaluator } from '../../goals/goal_evaluator.js';
import { ToolRegistry } from '../../tools/tool_registry.js';
import { ToolPermissions } from '../../tools/tool_permissions.js';
import { ToolExecutor } from '../../tools/tool_executor.js';
import { AgentToolRouter } from '../../tools/tool_router.js';
import { TaskStore } from '../../task_memory/task_store.js';
import { TaskPatterns } from '../../task_memory/task_patterns.js';
import { TaskSuccessRate } from '../../task_memory/task_success_rate.js';
import { TaskReuse } from '../../task_memory/task_reuse.js';
import { ArchitectureAnalyzer } from '../../self_evolution/architecture_analyzer.js';
import { CodeOptimizer } from '../../self_evolution/code_optimizer.js';
import { PerformanceMonitor } from '../../self_evolution/performance_monitor.js';
import { EvolutionPlanner } from '../../self_evolution/evolution_planner.js';
import { UpgradeExecutor } from '../../self_evolution/upgrade_executor.js';

export type AgentIntent =
  | 'coding'
  | 'debugging'
  | 'planning'
  | 'git'
  | 'memory_update'
  | 'documentation'
  | 'system_action'
  | 'learning'
  | 'casual_conversation';

export type ReasoningDepth = 'low' | 'medium' | 'high';
export type AdaptiveMode = 'casual' | 'strategic';

export interface PlannerOutput {
  goal: string;
  steps: string[];
  tools: string[];
  validation_required: boolean;
  retry_policy: {
    max_attempts: number;
    strategy: string;
  };
}

export interface InternalContract {
  intent: AgentIntent;
  complexity_score: number;
  ambiguity_score: number;
  selected_mode: AdaptiveMode;
  plan: PlannerOutput;
  tools_used: string[];
  confidence_score: number;
  next_recommended_action: string;
}

export interface EvaluationOutput {
  confidence_score: number;
  reasoning_depth: ReasoningDepth;
  tools_used: string[];
  next_recommended_action: string;
  clarification_required: boolean;
  reflection: {
    solved_goal: boolean;
    unsafe_assumptions: boolean;
    reasoning_shallow: boolean;
  };
}

export interface AgentExecutionResult {
  contract: InternalContract;
  evaluation: EvaluationOutput;
  clarification_question?: string;
  outcome_text: string;
  step_results: Array<{ step: string; tool: string; ok: boolean; detail: string }>;
  intelligence_update?: {
    compressed_knowledge_items: number;
    evaluation_score: number;
    training_dataset_count: number;
    research_enriched: boolean;
    selected_skills: string[];
    learned_skills?: string[];
    reflection_quality_score: number;
    active_agents: string[];
    curriculum_focus: string[];
    next_recommended_task: string;
    autonomous_research_topics?: string[];
    meta_intelligence_score?: number;
    awareness_curiosity_score?: number;
    goal_progress_score?: number;
    task_success_rate?: number;
    evolution_proposal_id?: string;
    task_reuse_candidates?: number;
  };
}

interface AgentRunInput {
  sessionId: string;
  message: string;
  context?: Record<string, unknown>;
  confirm?: boolean;
  forcedMode?: AdaptiveMode;
}

interface ToolCallInput {
  sessionId: string;
  message: string;
  step: string;
  context: Record<string, unknown>;
  retryAttempt: number;
}

interface ToolRunResult {
  ok: boolean;
  detail: string;
  data?: unknown;
}

interface ToolDefinition {
  name: string;
  run: (input: ToolCallInput) => Promise<ToolRunResult>;
}

export class AgentController {
  private readonly ambiguityThreshold = 62;
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly skillSystem = new SkillSystem();
  private readonly planningEngine = new TaskPlanningEngine();
  private readonly stepExecutor = new StepExecutor();
  private readonly compressor = new KnowledgeCompressor();
  private readonly responseEvaluator = new ResponseEvaluator();
  private readonly performanceMetrics = new PerformanceMetrics();
  private readonly knowledgeBuilder = new KnowledgeBuilder();
  private readonly datasetBuilder = new TrainingDatasetBuilder();
  private readonly microModelTrainer = new MicroModelTrainer();
  private readonly fileTools = new FileTools();
  private readonly gitTools = new GitTools();
  private readonly terminalTools = new TerminalTools();
  private readonly webTools = new WebTools();
  private readonly selfReflection = new ReflectionEngine();
  private readonly skillTracker = new SkillTracker();
  private readonly skillEngine = new SkillEngine();
  private readonly curriculumEngine = new CurriculumEngine();
  private readonly multiAgent = new AgentOrchestrator();
  private readonly intelligenceGraph = new IntelligenceGraph();
  private readonly continuousLearning = new ContinuousLearningEngine();
  private readonly metaController = new MetaController();
  private readonly researchScheduler = new ResearchScheduler();
  private readonly performanceAnalyzer = new PerformanceAnalyzer();
  private readonly mistakeDetector = new MistakeDetector();
  private readonly improvementPlanner = new ImprovementPlanner();
  private readonly awarenessEngine = new SelfAwarenessEngine();
  private readonly vectorMemoryStore = new VectorMemoryStore();
  private readonly semanticSearch = new SemanticSearch(this.vectorMemoryStore);
  private readonly retrievalEngine = new RetrievalEngine(this.semanticSearch);
  private readonly contextBuilder = new ContextBuilder();
  private readonly goalRegistry = new GoalRegistry();
  private readonly goalScheduler = new GoalScheduler();
  private readonly goalTracker = new GoalTracker(this.goalRegistry);
  private readonly goalEvaluator = new GoalEvaluator();
  private readonly secureToolRegistry = new ToolRegistry();
  private readonly secureToolPermissions = new ToolPermissions();
  private readonly secureToolExecutor = new ToolExecutor(this.secureToolRegistry);
  private readonly secureToolRouter = new AgentToolRouter(this.secureToolPermissions, this.secureToolExecutor);
  private readonly taskStore = new TaskStore();
  private readonly taskPatterns = new TaskPatterns();
  private readonly taskSuccessRate = new TaskSuccessRate();
  private readonly taskReuse = new TaskReuse();
  private readonly architectureAnalyzer = new ArchitectureAnalyzer();
  private readonly codeOptimizer = new CodeOptimizer();
  private readonly performanceMonitor = new PerformanceMonitor();
  private readonly evolutionPlanner = new EvolutionPlanner();
  private readonly upgradeExecutor = new UpgradeExecutor();

  constructor(
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService,
    private readonly safetyService: SafetyService,
    private readonly auditService: AuditService,
  ) {
    this.registerTools();
    this.goalRegistry.ensureDefaults();
  }

  classifyIntent(input: string): AgentIntent {
    const text = String(input || '').toLowerCase();
    if (this.isSmallTalk(text)) return 'casual_conversation';
    if (/(debug|bug|error|trace|exception|fix crash)/.test(text)) return 'debugging';
    if (/(refactor|clean code|optimi[sz]e code|architecture|design pattern|implement|class|function|api)/.test(text)) return 'coding';
    if (/(roadmap|plan|milestone|phase|strategy|breakdown)/.test(text)) return 'planning';
    if (/(git|commit|branch|merge|rebase|cherry-pick|pull request|pr)/.test(text)) return 'git';
    if (/(remember|save this|update memory|store this|profile update)/.test(text)) return 'memory_update';
    if (/(docs|documentation|readme|guide|explain api|spec)/.test(text)) return 'documentation';
    if (/(run command|execute|shell|terminal|delete file|overwrite|system)/.test(text)) return 'system_action';
    if (/(learn|practice|dsa|system design|interview prep|skill)/.test(text)) return 'learning';
    return 'casual_conversation';
  }

  scoreComplexity(input: string, intent: AgentIntent): number {
    const text = String(input || '');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    let score = Math.min(50, words * 1.7);

    if (/\n|```|class |function |interface |SELECT |CREATE TABLE/i.test(text)) score += 18;
    if (/(and|then|after that|step by step|also)/i.test(text)) score += 10;
    if (/(architecture|system design|multi-layer|distributed|scalable)/i.test(text)) score += 14;
    if (intent === 'planning' || intent === 'debugging' || intent === 'system_action') score += 12;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  scoreAmbiguity(input: string): number {
    const text = String(input || '').toLowerCase();
    if (!text.trim()) return 100;
    if (this.isSmallTalk(text)) return 5;

    let score = 0;
    const vagueMarkers = ['this', 'that', 'it', 'something', 'kuchh', 'jo bhi', 'same as before'];
    const directiveMarkers = ['implement', 'create', 'refactor', 'fix', 'plan', 'write', 'update'];

    vagueMarkers.forEach((m) => {
      if (text.includes(m)) score += 9;
    });

    if (!/[?.!]/.test(text)) score += 5;
    if (text.length < 18) score += 10;
    if (!directiveMarkers.some((m) => text.includes(m))) score += 14;
    if (!/\b(file|endpoint|route|module|function|class|ui|backend|extension)\b/.test(text)) score += 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  selectMode(input: string, complexityScore: number, ambiguityScore: number, intent: AgentIntent, forcedMode?: AdaptiveMode): AdaptiveMode {
    if (forcedMode) return forcedMode;
    const text = String(input || '').toLowerCase();
    if (this.isSmallTalk(text) || intent === 'casual_conversation') return 'casual';

    if (text.includes('switch to strategic mode')) return 'strategic';
    if (text.includes('switch to casual mode')) return 'casual';

    if (complexityScore >= 55 || ambiguityScore >= 45) return 'strategic';
    if (intent === 'planning' || intent === 'debugging' || intent === 'system_action' || intent === 'learning') return 'strategic';
    return 'casual';
  }

  buildPlan(goal: string, intent: AgentIntent, complexity: number, ambiguity: number): PlannerOutput {
    if (intent === 'casual_conversation') {
      return {
        goal,
        steps: [
          'Detect conversational intent and tone',
          'Generate direct response without toolchain execution',
        ],
        tools: [],
        validation_required: false,
        retry_policy: {
          max_attempts: 1,
          strategy: 'single_pass_fast_path',
        },
      };
    }

    const skillSelection = this.skillSystem.selectForRequest(goal, intent);
    const baseTools = this.selectTools(intent);
    const skillTools = skillSelection.selected.flatMap((s) => s.tools || []);
    const planned = this.planningEngine.planGoal(goal);
    const plannedTools = planned.steps.map((s) => this.normalizePlannedTool(s.suggested_tool));
    const tools = this.unique([...baseTools, ...skillTools, ...plannedTools]);
    const plannedTrace = this.stepExecutor.buildExecutionTrace(planned.steps, tools);

    const steps: string[] = [
      `Interpret request for intent=${intent} and gather required context`,
      `Execute toolchain: ${tools.join(', ') || 'none'}`,
      ...plannedTrace.map((t) => `Planned execution: ${t}`),
      'Validate result quality and coverage against goal',
      'Synthesize final response with clear next action',
    ];

    if (ambiguity >= this.ambiguityThreshold) {
      steps.unshift('Ask targeted clarification question before execution');
    }

    const validationRequired = complexity >= 45;

    return {
      goal,
      steps,
      tools,
      validation_required: validationRequired,
      retry_policy: {
        max_attempts: complexity >= 70 ? 3 : 2,
        strategy: 'adjust_prompt_then_retry_then_request_clarification',
      },
    };
  }

  buildInternalContract(input: string, forcedMode?: AdaptiveMode): InternalContract {
    const intent = this.classifyIntent(input);
    const complexity = this.scoreComplexity(input, intent);
    const ambiguity = this.scoreAmbiguity(input);
    const mode = this.selectMode(input, complexity, ambiguity, intent, forcedMode);
    const plan = this.buildPlan(input, intent, complexity, ambiguity);

    return {
      intent,
      complexity_score: complexity,
      ambiguity_score: ambiguity,
      selected_mode: mode,
      plan,
      tools_used: [],
      confidence_score: 0,
      next_recommended_action: 'Execute plan and evaluate outcome.',
    };
  }

  needsClarification(contract: InternalContract): boolean {
    if (contract.intent === 'casual_conversation') return false;
    return contract.ambiguity_score > this.ambiguityThreshold;
  }

  clarificationQuestion(contract: InternalContract): string {
    switch (contract.intent) {
      case 'coding':
      case 'debugging':
        return 'Kaunsa file/path aur expected output batao, tab main exact fix/refactor dunga.';
      case 'planning':
        return 'Is plan ka exact final outcome kya chahiye: feature delivery, architecture doc, ya milestone tracker?';
      case 'git':
        return 'Git action me kya chahiye: commit message, branch strategy, ya merge/rebase guidance?';
      default:
        return 'Thoda specific batao: exact goal, scope, aur expected result kya hai?';
    }
  }

  async run(input: AgentRunInput): Promise<AgentExecutionResult> {
    const contract = this.buildInternalContract(input.message, input.forcedMode);

    if (this.needsClarification(contract)) {
      const evaluation = this.evaluate(contract, [], true);
      contract.confidence_score = evaluation.confidence_score;
      contract.next_recommended_action = evaluation.next_recommended_action;
      return {
        contract,
        evaluation,
        clarification_question: this.clarificationQuestion(contract),
        outcome_text: 'Clarification required before execution.',
        step_results: [],
      };
    }

    const stepResults: Array<{ step: string; tool: string; ok: boolean; detail: string }> = [];
    const toolsUsed: string[] = [];
    const orchestrated = await this.multiAgent.orchestrate(input.message, input.context);
    const agentOutputs = orchestrated.outputs;
    const retrievedMemory = this.retrievalEngine.retrieve(input.message, 6);
    const semanticContext = this.contextBuilder.build(retrievedMemory);

    for (const step of contract.plan.steps) {
      if (!step.toLowerCase().includes('execute toolchain')) continue;

      for (const toolName of contract.plan.tools) {
        const tool = this.tools.get(toolName);
        if (!tool) continue;

        const result = await this.executeWithRetry(tool, {
          sessionId: input.sessionId,
          message: input.message,
          step,
          context: input.context || {},
        }, contract.plan.retry_policy.max_attempts, this.agentForIntent(contract.intent));

        stepResults.push({ step, tool: toolName, ok: result.ok, detail: result.detail });
        toolsUsed.push(toolName);

        if (!result.ok && contract.plan.validation_required) {
          const evaluation = this.evaluate(contract, toolsUsed, true);
          contract.tools_used = toolsUsed;
          contract.confidence_score = evaluation.confidence_score;
          contract.next_recommended_action = evaluation.next_recommended_action;
          return {
            contract,
            evaluation,
            clarification_question: 'Tool execution failed. Kya aap context/inputs refine karna chahenge?',
            outcome_text: result.detail,
            step_results: stepResults,
          };
        }
      }
    }

    const evaluation = this.evaluate(contract, toolsUsed, false);
    contract.tools_used = toolsUsed;
    contract.confidence_score = evaluation.confidence_score;
    contract.next_recommended_action = evaluation.next_recommended_action;

    const summaryPrompt = [
      'You are ASTRO operational synthesis engine.',
      `Mode: ${contract.selected_mode}`,
      `Intent: ${contract.intent}`,
      'Generate concise final response for user.',
      semanticContext || '',
      `Original user request: ${input.message}`,
      `Step results: ${JSON.stringify(stepResults).slice(0, 10000)}`,
      'If uncertainty remains, ask one smart follow-up question.',
    ].join('\n');

    const outcomeText = await this.chatService.processMessage(input.sessionId, summaryPrompt);
    this.vectorMemoryStore.upsert(
      `request=${input.message}\nintent=${contract.intent}\noutcome=${outcomeText}\nsteps=${JSON.stringify(stepResults).slice(0, 2400)}`,
      { session_id: input.sessionId, intent: contract.intent },
    );

    const quality = this.responseEvaluator.evaluate({
      request: input.message,
      response: outcomeText,
      steps_executed: stepResults.length,
      had_failure: stepResults.some((s) => !s.ok),
    });
    this.performanceMetrics.record({
      timestamp: new Date().toISOString(),
      session_id: input.sessionId,
      intent: contract.intent,
      routed_tools: toolsUsed,
      score: quality,
    });

    const compressed = this.compressor.compressInteraction({
      timestamp: new Date().toISOString(),
      user_message: input.message,
      assistant_response: outcomeText,
      context: JSON.stringify(input.context || {}),
      tags: ['agent_execution', contract.intent],
    });

    const research = await this.knowledgeBuilder.detectAndBuild(input.message);
    const dataset = this.datasetBuilder.buildUnifiedExport();
    this.microModelTrainer.preparePlans(dataset.output_file);
    const selectedSkills = this.skillSystem.selectForRequest(input.message, contract.intent).selected.map((s) => s.id);
    const learned = this.skillEngine.detectAndLearn({
      task: input.message,
      conversation: JSON.stringify(input.context || {}),
      assistantResponse: outcomeText,
    });
    const reflection = this.selfReflection.updateBehaviorProfile({
      session_id: input.sessionId,
      request: input.message,
      response: outcomeText,
      context: JSON.stringify(stepResults),
    });
    const skillGraph = this.skillTracker.trackSession({
      message: input.message,
      response: outcomeText,
      intent: contract.intent,
    });
    const curriculum = this.curriculumEngine.generateRoadmap(skillGraph);
    for (const skillId of selectedSkills.slice(0, 5)) {
      this.curriculumEngine.updateSkillCompletion(skillId, quality.final_score >= 70 ? 'pass' : 'partial');
      this.skillEngine.evolveSkill(
        skillId.split('.')[0] || skillId,
        quality.final_score >= 75 ? 'success' : quality.final_score >= 50 ? 'partial' : 'failure',
        quality.final_score >= 75 ? 'Execution quality was strong.' : 'Needs stronger reasoning, testing, or safety checks.',
      );
    }
    this.curriculumEngine.trackProgress({
      evaluation_score: quality.final_score,
      reflection_score: reflection.quality_score,
    });
    this.intelligenceGraph.upsertConcepts([
      contract.intent,
      ...selectedSkills,
      ...agentOutputs.map((a) => a.agent),
      ...curriculum.map((c) => c.skill),
    ]);
    const learningUpdate = await this.continuousLearning.ingestFromActivity({
      timestamp: new Date().toISOString(),
      session_id: input.sessionId,
      user_message: input.message,
      assistant_response: outcomeText,
      detected_topic: contract.intent,
      coding_context: JSON.stringify(input.context || {}),
      tags: ['agent_execution', contract.intent, ...selectedSkills],
    });
    for (const category of learningUpdate.skill_categories) {
      this.skillEngine.detectAndLearn({
        task: input.message,
        conversation: `category=${category}`,
        assistantResponse: outcomeText,
      });
    }

    const autonomousResearch = await this.researchScheduler.runCycle({
      message: input.message,
      tags: [contract.intent, ...selectedSkills, ...learningUpdate.skill_categories],
      skillHints: selectedSkills,
    });

    const recentReflections = this.selfReflection.recentReviews(30);
    const reflectionScores = recentReflections
      .map((r) => Number((r?.reflection as Record<string, unknown> | undefined)?.quality_score || 0))
      .filter((n) => Number.isFinite(n));
    const perfSummary = this.performanceMetrics.summary(200);
    const failedSteps = stepResults.filter((s) => !s.ok).map((s) => ({ step: s.step, tool: s.tool }));
    const mistakePatterns = this.mistakeDetector.detect({
      reflection_comments: recentReflections.map((r) => JSON.stringify((r?.reflection as Record<string, unknown>) || {})),
      failed_steps: failedSteps,
    });
    const performanceSnapshot = this.performanceAnalyzer.analyze({
      evaluation_summary: {
        average_score: perfSummary.avg_final_score,
        success_rate: perfSummary.avg_task_success / 100,
      },
      reflection_scores: reflectionScores,
      tool_failures: failedSteps.length,
      total_tool_runs: Math.max(stepResults.length, 1),
    });
    const selfImprovement = this.improvementPlanner.plan(performanceSnapshot, mistakePatterns);

    const skillSummary = this.skillEngine.intelligenceSummary();
    const meta = this.metaController.analyze({
      evaluation_score: Math.round(perfSummary.avg_final_score || quality.final_score),
      average_skill_intelligence: Math.round(skillSummary.average_intelligence || 0),
      skills: (skillSummary.top_skills || []).map((s) => ({ id: s.id, intelligence_score: s.intelligence_score })),
      repeated_mistakes: mistakePatterns.filter((m) => m.frequency >= 2).map((m) => m.name),
      research_gaps: autonomousResearch.topics_detected.filter((topic) => !autonomousResearch.built_topics.some((b) => b.topic === topic)),
      reasoning_fail_rate: performanceSnapshot.evaluation_score < 70 ? 0.4 : 0.1,
      tool_failure_rate: performanceSnapshot.tool_failure_rate,
      active_agents: orchestrated.active_agents,
    });

    const knownConcepts = this.intelligenceGraph.snapshot().nodes.map((n) => n.id).slice(0, 300);
    const awareness = this.awarenessEngine.evaluate({
      request: input.message,
      response: outcomeText,
      known_concepts: knownConcepts,
      research_topics: autonomousResearch.topics_detected,
      recent_quality_score: quality.final_score,
    });
    const goals = this.goalTracker.trackFromMetrics({
      avg_score: perfSummary.avg_final_score || quality.final_score,
      research_runs: autonomousResearch.ran ? 1 : 0,
      debug_signal: quality.final_score,
    });
    const goalEval = this.goalEvaluator.evaluate(goals);
    this.taskStore.add({
      ts: new Date().toISOString(),
      request: input.message.slice(0, 1200),
      intent: contract.intent,
      success: quality.task_success >= 70,
      score: quality.final_score,
      tools: toolsUsed,
      outcome: outcomeText.slice(0, 1800),
    });
    const recentTasks = this.taskStore.recent(120);
    const taskPatterns = this.taskPatterns.detect(recentTasks);
    const taskSuccess = this.taskSuccessRate.evaluate(recentTasks);
    const taskReuse = this.taskReuse.suggest(input.message, recentTasks);
    const perfMonitor = this.performanceMonitor.snapshot({
      avg_score: perfSummary.avg_final_score || quality.final_score,
      success_rate: taskSuccess.success_rate,
      tool_failure_rate: performanceSnapshot.tool_failure_rate,
      system_intelligence_score: meta.intelligence_score,
    });
    const arch = this.architectureAnalyzer.analyze({
      avg_score: perfMonitor.avg_score,
      failure_rate: 1 - perfMonitor.success_rate,
      curiosity_score: awareness.curiosity_score,
    });
    const codeHints = this.codeOptimizer.suggest({
      weaknesses: arch.weaknesses,
      top_tools: taskPatterns.top_tools as Array<[string, number]>,
    });
    const evoPlan = this.evolutionPlanner.plan({
      weaknesses: arch.weaknesses,
      optimizer_suggestions: codeHints,
      health: perfMonitor.health,
    });
    const proposal = this.upgradeExecutor.publish(evoPlan);

    return {
      contract,
      evaluation,
      outcome_text: outcomeText,
      step_results: stepResults,
      intelligence_update: {
        compressed_knowledge_items: compressed.items,
        evaluation_score: quality.final_score,
        training_dataset_count: dataset.count,
        research_enriched: research.built,
        selected_skills: selectedSkills,
        learned_skills: learned.detected,
        reflection_quality_score: reflection.quality_score,
        active_agents: orchestrated.active_agents,
        curriculum_focus: curriculum.map((c) => c.skill).slice(0, 5),
        next_recommended_task: curriculum[0]?.skill || 'none',
        autonomous_research_topics: autonomousResearch.topics_detected,
        meta_intelligence_score: meta.intelligence_score,
        awareness_curiosity_score: awareness.curiosity_score,
        goal_progress_score: goalEval.average_progress,
        task_success_rate: taskSuccess.success_rate,
        evolution_proposal_id: String(proposal.id || ''),
        task_reuse_candidates: taskReuse.reuse_candidates.length,
      },
    };
  }

  private async executeWithRetry(
    tool: ToolDefinition,
    input: Omit<ToolCallInput, 'retryAttempt'>,
    maxAttempts: number,
    agentId = 'system',
  ): Promise<ToolRunResult> {
    let attempt = 1;
    let latest: ToolRunResult = { ok: false, detail: 'uninitialized' };

    while (attempt <= maxAttempts) {
      try {
        const routed = await this.secureToolRouter.route({
          agent_id: agentId,
          tool_name: tool.name,
          payload: { ...input, retryAttempt: attempt } as Record<string, unknown>,
        });
        latest = {
          ok: Boolean(routed.ok),
          detail: String(routed.detail || ''),
          data: routed.data,
        };
        if (latest.ok) return latest;
      } catch (err) {
        latest = { ok: false, detail: `Attempt ${attempt} failed: ${String(err)}` };
      }
      attempt += 1;
    }

    return {
      ok: false,
      detail: `${latest.detail}. Retry policy exhausted (${maxAttempts}).`,
    };
  }

  private evaluate(contract: InternalContract, toolsUsed: string[], clarificationRequired: boolean): EvaluationOutput {
    const solvedGoal = !clarificationRequired && toolsUsed.length > 0;
    const unsafeAssumptions = contract.ambiguity_score > this.ambiguityThreshold;

    const confidenceBase = 78 - Math.round(contract.ambiguity_score * 0.35) + Math.round(contract.complexity_score * 0.1);
    const confidence = Math.max(10, Math.min(100, solvedGoal ? confidenceBase : Math.min(confidenceBase, 42)));

    let depth: ReasoningDepth = 'low';
    if (contract.complexity_score >= 40) depth = 'medium';
    if (contract.complexity_score >= 72 || contract.selected_mode === 'strategic') depth = 'high';

    return {
      confidence_score: confidence,
      reasoning_depth: depth,
      tools_used: toolsUsed,
      next_recommended_action: clarificationRequired
        ? 'Ask one precise clarification and resume execution.'
        : contract.selected_mode === 'strategic'
          ? 'Validate with one follow-up check and propose next milestone.'
          : 'Provide concise answer and optional next step.',
      clarification_required: clarificationRequired,
      reflection: {
        solved_goal: solvedGoal,
        unsafe_assumptions: unsafeAssumptions,
        reasoning_shallow: depth === 'low' && contract.selected_mode === 'strategic',
      },
    };
  }

  private selectTools(intent: AgentIntent): string[] {
    switch (intent) {
      case 'coding':
        return ['analyze', 'complete', 'refactor', 'skill_update'];
      case 'debugging':
        return ['analyze', 'fix', 'anti_pattern_check', 'skill_update'];
      case 'planning':
        return ['doc_retrieve', 'analyze'];
      case 'git':
        return ['git_commit'];
      case 'memory_update':
        return ['memory_update'];
      case 'documentation':
        return ['doc_retrieve'];
      case 'system_action':
        return ['analyze'];
      case 'learning':
        return ['skill_update', 'doc_retrieve', 'web_lookup'];
      default:
        return ['doc_retrieve'];
    }
  }

  private registerTools(): void {
    this.register('explain', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Explain this clearly and practically:\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1500), data: reply };
    });

    this.register('refactor', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Refactor recommendation with rationale:\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1500), data: reply };
    });

    this.register('fix', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Find likely bug and propose fix:\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1500), data: reply };
    });

    this.register('analyze', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Perform technical analysis (quality/perf/security risks):\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1500), data: reply };
    });

    this.register('complete', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Suggest concise next code completion:\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1200), data: reply };
    });

    this.register('snippet_generate', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Generate reusable snippet for:\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1200), data: reply };
    });

    this.register('git_commit', async (input) => {
      const assess = this.safetyService.assessAction({
        type: 'commit',
        intent: input.message,
        confirm: Boolean((input.context || {}).confirm),
      });
      if (!assess.allowed) {
        this.logAction('tool_git_commit', 'blocked', input.sessionId, { reason: assess.reason });
        return { ok: false, detail: assess.reason || 'commit blocked by safety policy' };
      }

      const reply = await this.chatService.processMessage(input.sessionId, `Write a conventional commit message for:\n${input.message}`);
      this.logAction('tool_git_commit', 'allowed', input.sessionId, { chars: reply.length });
      return { ok: true, detail: reply.slice(0, 1200), data: reply };
    });

    this.register('memory_update', async (input) => {
      const result = this.memoryService.upsert({
        namespace: 'profiles',
        key: `memory_${Date.now()}`,
        value: {
          source: 'agent_controller',
          message: input.message.slice(0, 2000),
          ts: new Date().toISOString(),
        },
        tags: ['agent', 'memory_update'],
      });
      this.logAction('tool_memory_update', 'allowed', input.sessionId, { namespace: result.namespace, key: result.key });
      return { ok: true, detail: `Memory updated: ${result.namespace}/${result.key}`, data: result };
    });

    this.register('doc_retrieve', async (input) => {
      const reply = await this.chatService.processMessage(input.sessionId, `Use available project context/docs and answer:\n${input.message}`);
      return { ok: true, detail: reply.slice(0, 1500), data: reply };
    });

    this.register('skill_update', async (input) => {
      const summary = this.memoryService.updateSkillProgressFromText(input.message);
      return {
        ok: true,
        detail: `Skill progress updated: topics=${summary.topics_updated}, trend=${summary.difficulty_trend}`,
        data: summary,
      };
    });

    this.register('anti_pattern_check', async (input) => {
      const summary = this.memoryService.recordAntiPatternFromText(input.message);
      return {
        ok: true,
        detail: `Anti-pattern tracker updated: ${summary.pattern}`,
        data: summary,
      };
    });

    this.register('file_ops', async (input) => {
      const workspaceRoot = String(input.context.workspace_root || '');
      const filePath = String(input.context.file_path || '');
      if (workspaceRoot && filePath) {
        const read = this.fileTools.readFileSafe(workspaceRoot, filePath);
        return { ok: read.ok, detail: read.detail, data: read.content?.slice(0, 2000) };
      }
      const listed = this.fileTools.listFiles(workspaceRoot || process.cwd(), 40);
      return { ok: listed.ok, detail: listed.detail, data: listed.files };
    });

    this.register('git_ops', async (input) => {
      const workspaceRoot = String(input.context.workspace_root || process.cwd());
      const status = this.gitTools.status(workspaceRoot);
      const diff = this.gitTools.stagedDiff(workspaceRoot);
      return {
        ok: status.ok || diff.ok,
        detail: `${status.detail}; ${diff.detail}`,
        data: { status: status.output?.slice(0, 2000), diff: diff.diff?.slice(0, 3000) },
      };
    });

    this.register('terminal_ops', async (input) => {
      const workspaceRoot = String(input.context.workspace_root || process.cwd());
      const mode = /test/i.test(input.message) ? ['run', 'test'] : ['-v'];
      const out = this.terminalTools.runSafe(workspaceRoot, 'npm', mode);
      return { ok: out.ok, detail: out.detail, data: out.output };
    });

    this.register('web_lookup', async (input) => {
      const res = await this.webTools.search(input.message, 4);
      return {
        ok: res.ok,
        detail: res.detail,
        data: res.results,
      };
    });
  }

  private register(name: string, run: ToolDefinition['run']): void {
    this.tools.set(name, { name, run });
    this.secureToolRegistry.register(name, async (input) => {
      const out = await run(input as unknown as ToolCallInput);
      return {
        ok: out.ok,
        detail: out.detail,
        data: out.data,
      };
    });
  }

  private isSmallTalk(text: string): boolean {
    const clean = String(text || '').trim().toLowerCase();
    if (!clean) return false;
    if (clean.length <= 24 && /^(h(i|ello|ey)|yo|hola|namaste|hey there|hlo|hlw)[!. ]*$/i.test(clean)) return true;
    if (/^(how are you|kya haal|kaisa hai|kya kar rahe ho)[?!. ]*$/i.test(clean)) return true;
    if (/^(ok|okay|thanks|thank you|thx|done|haan|ha|hmm)[!. ]*$/i.test(clean)) return true;
    return false;
  }

  mapMessageForMode(message: string, mode: AdaptiveMode, intent?: AgentIntent): string {
    const text = String(message || '').trim();
    const low = text.toLowerCase();

    if (this.isSmallTalk(low)) {
      return [
        'You are ASTRO personal assistant.',
        'User is doing normal conversation/small-talk.',
        'Reply naturally in 1-2 short lines. Human and friendly tone.',
        'Do not use section headings like Problem Framing, Ambiguity, Clarification.',
        `User message: ${text}`,
      ].join('\n');
    }

    if (mode === 'strategic') {
      return [
        'You are ASTRO autonomous technical assistant.',
        'Auto-decide depth and approach based on user intent and complexity.',
        `Detected intent: ${intent || 'unknown'}.`,
        'Give answer directly first, then only necessary steps.',
        'Ask clarification only when critical input is missing for safe/accurate execution.',
        'Do not use rigid report templates unless user explicitly asks for it.',
        'Keep tone confident, practical, and assistant-like.',
        `User request: ${text}`,
      ].join('\n');
    }

    return [
      'You are ASTRO personal assistant.',
      'Give concise, helpful, natural response in conversational style.',
      'No over-structuring. No formal template headings.',
      'Do not imply emotional dependency, exclusivity, or physical existence.',
      `User request: ${text}`,
    ].join('\n');
  }

  logAction(action: string, status: 'allowed' | 'blocked' | 'error', sessionId: string | undefined, details?: Record<string, unknown>): void {
    this.auditService.log({
      ts: new Date().toISOString(),
      route: '/agent/internal',
      action,
      status,
      session_id: sessionId,
      details,
    });
  }

  checkAction(type: SafetyActionType, opts: { intent: string; confirm?: boolean; overwrite?: boolean; destructive?: boolean; multiFileCount?: number }) {
    return this.safetyService.assessAction({
      type,
      intent: opts.intent,
      confirm: !!opts.confirm,
      overwrite: !!opts.overwrite,
      destructive: !!opts.destructive,
      multi_file_count: opts.multiFileCount,
    });
  }

  getEvolutionStatus(): {
    skills: ReturnType<SkillTracker['snapshot']>;
    curriculum: ReturnType<CurriculumEngine['generateRoadmap']>;
    next_task: ReturnType<CurriculumEngine['getNextRecommendedTask']>;
    suggested_resources: string[];
    intelligence_graph: ReturnType<IntelligenceGraph['snapshot']>;
    evaluation_summary: ReturnType<PerformanceMetrics['summary']>;
    agents: string[];
    agent_activity: ReturnType<AgentOrchestrator['recentActivity']>;
    recent_reflections: ReturnType<ReflectionEngine['recentReviews']>;
    skill_evolution: ReturnType<SkillEngine['intelligenceSummary']>;
    autonomous_research: ReturnType<ResearchScheduler['latest']>;
    self_improvement: ReturnType<ImprovementPlanner['latest']>;
    meta_intelligence: ReturnType<MetaController['latest']>;
    awareness: ReturnType<SelfAwarenessEngine['latest']>;
    vector_memory: ReturnType<VectorMemoryStore['stats']>;
    long_term_goals: {
      goals: ReturnType<GoalRegistry['list']>;
      evaluation: ReturnType<GoalEvaluator['evaluate']>;
      schedule: ReturnType<GoalScheduler['schedule']>;
    };
    task_memory: {
      success: ReturnType<TaskSuccessRate['evaluate']>;
      patterns: ReturnType<TaskPatterns['detect']>;
      reuse_sample: ReturnType<TaskReuse['suggest']>;
    };
    self_evolution: {
      proposals: ReturnType<UpgradeExecutor['recent']>;
    };
    system_intelligence_score: number;
  } {
    const skills = this.skillTracker.snapshot();
    const nextTask = this.curriculumEngine.getNextRecommendedTask(skills);
    const evalSummary = this.performanceMetrics.summary(200);
    const skillIntelligence = this.skillEngine.intelligenceSummary().average_intelligence || 0;
    const meta = this.metaController.latest();
    const goals = this.goalRegistry.list();
    const recentTasks = this.taskStore.recent(200);
    const systemIntelligenceScore = meta?.intelligence_score
      ?? Math.max(0, Math.min(100, Math.round((evalSummary.avg_final_score * 0.6) + (skillIntelligence * 0.4))));

    return {
      skills,
      curriculum: this.curriculumEngine.generateRoadmap(skills),
      next_task: nextTask,
      suggested_resources: nextTask ? this.curriculumEngine.suggestLearningResources(nextTask.skill) : [],
      intelligence_graph: this.intelligenceGraph.snapshot(),
      evaluation_summary: evalSummary,
      agents: this.multiAgent.listAgentIds(),
      agent_activity: this.multiAgent.recentActivity(20),
      recent_reflections: this.selfReflection.recentReviews(20),
      skill_evolution: this.skillEngine.intelligenceSummary(),
      autonomous_research: this.researchScheduler.latest(),
      self_improvement: this.improvementPlanner.latest(),
      meta_intelligence: meta,
      awareness: this.awarenessEngine.latest(),
      vector_memory: this.vectorMemoryStore.stats(),
      long_term_goals: {
        goals,
        evaluation: this.goalEvaluator.evaluate(goals),
        schedule: this.goalScheduler.schedule(goals),
      },
      task_memory: {
        success: this.taskSuccessRate.evaluate(recentTasks),
        patterns: this.taskPatterns.detect(recentTasks),
        reuse_sample: this.taskReuse.suggest('current task', recentTasks),
      },
      self_evolution: {
        proposals: this.upgradeExecutor.recent(20),
      },
      system_intelligence_score: systemIntelligenceScore,
    };
  }

  listSkills() {
    return this.skillEngine.listSkills();
  }

  getSkillDetails(skillId: string) {
    return this.skillEngine.getSkillDetails(skillId);
  }

  setSkillEnabled(skillId: string, enabled: boolean) {
    return this.skillEngine.setSkillEnabled(skillId, enabled);
  }

  learnSkill(input: { task: string; conversation?: string; assistantResponse?: string }) {
    return this.skillEngine.detectAndLearn(input);
  }

  evolveSkill(skillId: string, result: 'success' | 'partial' | 'failure', notes?: string) {
    return this.skillEngine.evolveSkill(skillId, result, notes);
  }

  runSkill(skillId: string, input: { message: string; context?: Record<string, unknown> }) {
    return this.skillEngine.runSkill(skillId, input);
  }

  async runAutonomousMaintenance() {
    const research = await this.researchScheduler.runCycle({
      message: 'autonomous system optimization trends for ai developer assistant',
      tags: ['autonomous', 'maintenance'],
      skillHints: this.skillEngine.intelligenceSummary().top_skills.map((s) => s.id),
    });
    const status = this.getEvolutionStatus();
    const mistakeNames = status.recent_reflections
      .map((r) => JSON.stringify((r?.reflection as Record<string, unknown>) || {}))
      .filter((s) => s.length > 2)
      .slice(0, 10);
    const meta = this.metaController.analyze({
      evaluation_score: Math.round(status.evaluation_summary.avg_final_score || 0),
      average_skill_intelligence: Math.round(status.skill_evolution.average_intelligence || 0),
      skills: (status.skill_evolution.top_skills || []).map((s) => ({ id: s.id, intelligence_score: s.intelligence_score })),
      repeated_mistakes: mistakeNames,
      research_gaps: (research.topics_detected || []).filter((t) => !(research.built_topics || []).some((b) => b.topic === t)),
      reasoning_fail_rate: status.evaluation_summary.avg_final_score < 70 ? 0.4 : 0.1,
      tool_failure_rate: 0.1,
      active_agents: status.agents,
    });
    return { research, meta_score: meta.intelligence_score };
  }

  private agentForIntent(intent: AgentIntent): string {
    switch (intent) {
      case 'coding': return 'coding_agent';
      case 'debugging': return 'debug_agent';
      case 'planning': return 'planning_agent';
      case 'learning': return 'learning_agent';
      case 'git':
      case 'system_action': return 'automation_agent';
      default: return 'system';
    }
  }

  private normalizePlannedTool(tool: string): string {
    const t = String(tool || '').trim().toLowerCase();
    if (t === 'coding_skill') return 'analyze';
    if (t === 'performance_scan') return 'analyze';
    if (t === 'security_scan') return 'analyze';
    if (this.tools.has(t)) return t;
    return 'analyze';
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean)));
  }
}
