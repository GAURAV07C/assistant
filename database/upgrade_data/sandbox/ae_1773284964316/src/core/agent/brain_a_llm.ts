import type { GroqService } from '../../services/groqService.js';

export interface BrainReply {
  response: string;
  meta: { sources: string[]; confidence: number };
}

export class BrainALLM {
  constructor(private readonly groqService: GroqService) {}

  async reply(question: string, history: Array<[string, string]>, mode: 'general' | 'extension'): Promise<BrainReply> {
    if (mode === 'extension') {
      return this.groqService.getExtensionCodeResponseWithMeta(question, history);
    }
    return this.groqService.getResponseWithMeta(question, history);
  }
}
