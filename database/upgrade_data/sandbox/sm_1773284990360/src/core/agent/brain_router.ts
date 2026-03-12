import { InputFilter } from '../../guardrails/input_filter.js';
import { OutputFilter } from '../../guardrails/output_filter.js';
import { PolicyEngine } from '../../guardrails/policy_engine.js';
import type { GroqService } from '../../services/groqService.js';
import type { RealtimeGroqService } from '../../services/realtimeService.js';
import { BrainALLM, type BrainReply } from './brain_a_llm.js';
import { BrainBReasoning } from './brain_b_reasoning.js';
import { RouterLogs } from '../safety/router_logs.js';

export interface BrainRouteResult {
  response: string;
  meta: { sources: string[]; confidence: number };
  routed_to: 'brain_a' | 'brain_b' | 'educational';
  reason: string;
  category: 'normal' | 'research' | 'risky';
  risk_score: number;
}

export class BrainRouter {
  private readonly inputFilter = new InputFilter();
  private readonly policyEngine = new PolicyEngine();
  private readonly outputFilter = new OutputFilter();
  private readonly logs = new RouterLogs();
  private readonly brainA: BrainALLM;
  private readonly brainB: BrainBReasoning;

  constructor(
    groqService: GroqService,
    realtimeService?: RealtimeGroqService,
  ) {
    this.brainA = new BrainALLM(groqService);
    this.brainB = new BrainBReasoning(groqService, realtimeService);
  }

  async route(
    query: string,
    history: Array<[string, string]>,
    opts?: { mode?: 'general' | 'extension'; preferResearch?: boolean },
  ): Promise<BrainRouteResult> {
    const mode = opts?.mode || 'general';
    const filtered = this.inputFilter.analyze(query);
    const decision = this.policyEngine.decide(filtered, { preferResearch: !!opts?.preferResearch });

    if (decision.action === 'educational') {
      const safe = this.outputFilter.sanitize('', { forceEducational: true });
      this.writeLog(query, filtered.category, filtered.risk_score, 'educational', decision.reason);
      return {
        response: safe,
        meta: { sources: [], confidence: 0.95 },
        routed_to: 'educational',
        reason: decision.reason,
        category: filtered.category,
        risk_score: filtered.risk_score,
      };
    }

    if (decision.action === 'research') {
      const b = await this.brainB.reply(query, history, mode);
      return this.finalize(query, filtered, b, 'brain_b', decision.reason, false);
    }

    try {
      const a = await this.brainA.reply(query, history, mode);
      return this.finalize(query, filtered, a, 'brain_a', decision.reason, false);
    } catch {
      const b = await this.brainB.reply(query, history, mode);
      return this.finalize(query, filtered, b, 'brain_b', 'Brain A failed/refused. Fallback to Brain B.', false);
    }
  }

  async routeToBrain(
    query: string,
    history: Array<[string, string]>,
    opts?: { mode?: 'general' | 'extension'; preferResearch?: boolean },
  ): Promise<BrainRouteResult> {
    return this.route(query, history, opts);
  }

  private finalize(
    query: string,
    filtered: { category: 'normal' | 'research' | 'risky'; risk_score: number },
    reply: BrainReply,
    routedTo: 'brain_a' | 'brain_b',
    reason: string,
    forceEducational: boolean,
  ): BrainRouteResult {
    const safe = this.outputFilter.sanitize(reply.response, { forceEducational });
    this.writeLog(query, filtered.category, filtered.risk_score, routedTo, reason);
    return {
      response: safe,
      meta: reply.meta,
      routed_to: routedTo,
      reason,
      category: filtered.category,
      risk_score: filtered.risk_score,
    };
  }

  private writeLog(
    query: string,
    category: 'normal' | 'research' | 'risky',
    riskScore: number,
    routedTo: 'brain_a' | 'brain_b' | 'educational',
    reason: string,
  ): void {
    this.logs.write({
      query: String(query || '').slice(0, 1000),
      category,
      risk_score: riskScore,
      routed_to: routedTo,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  logRoutingDecision(
    query: string,
    category: 'normal' | 'research' | 'risky',
    riskScore: number,
    routedTo: 'brain_a' | 'brain_b' | 'educational',
    reason: string,
  ): void {
    this.writeLog(query, category, riskScore, routedTo, reason);
  }
}
