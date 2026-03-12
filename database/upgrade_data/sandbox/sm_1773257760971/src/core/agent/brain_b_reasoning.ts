import type { GroqService } from '../../services/groqService.js';
import type { RealtimeGroqService } from '../../services/realtimeService.js';

export interface BrainReply {
  response: string;
  meta: { sources: string[]; confidence: number };
}

export class BrainBReasoning {
  constructor(
    private readonly groqService: GroqService,
    private readonly realtimeService?: RealtimeGroqService,
  ) {}

  async reply(question: string, history: Array<[string, string]>, mode: 'general' | 'extension'): Promise<BrainReply> {
    const enriched = [
      'Use deep reasoning with explicit assumptions and constraints.',
      'Prefer evidence-backed answer. If uncertain, clearly say what is missing.',
      `User query: ${question}`,
    ].join('\n');

    if (this.realtimeService) {
      if (mode === 'extension') {
        return this.realtimeService.getExtensionCodeRealtimeResponseWithMeta(enriched, history);
      }
      return this.realtimeService.getResponseWithMeta(enriched, history);
    }

    if (mode === 'extension') {
      return this.groqService.getExtensionCodeResponseWithMeta(enriched, history);
    }
    return this.groqService.getResponseWithMeta(enriched, history);
  }
}
