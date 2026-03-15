export interface RawInteraction {
  timestamp: string;
  user_message: string;
  assistant_response: string;
  context?: string;
  tags?: string[];
}

export interface ExtractedKnowledge {
  topic: string;
  summary: string;
  kind: 'coding_pattern' | 'architecture_idea' | 'problem_solution' | 'preference' | 'general';
  confidence: number;
}

export class KnowledgeExtractor {
  extract(input: RawInteraction): ExtractedKnowledge[] {
    const merged = `${input.user_message}\n${input.assistant_response}`.toLowerCase();
    const out: ExtractedKnowledge[] = [];

    const push = (kind: ExtractedKnowledge['kind'], topic: string, summary: string, confidence: number) => {
      out.push({ kind, topic, summary: summary.slice(0, 600), confidence: Math.max(0, Math.min(1, confidence)) });
    };

    if (/\b(refactor|clean code|modular|pattern)\b/.test(merged)) push('coding_pattern', 'coding', input.assistant_response, 0.8);
    if (/\b(architecture|system design|tradeoff|scalable)\b/.test(merged)) push('architecture_idea', 'architecture', input.assistant_response, 0.82);
    if (/\b(fix|bug|error|root cause|solution)\b/.test(merged)) push('problem_solution', 'debugging', input.assistant_response, 0.85);
    if (/\b(prefer|style|indent|semicolon|quotes?)\b/.test(merged)) push('preference', 'user_style', input.user_message, 0.78);
    if (out.length === 0) push('general', 'general', input.assistant_response, 0.55);

    return out;
  }
}
