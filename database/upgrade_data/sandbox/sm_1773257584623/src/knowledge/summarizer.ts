import type { ExtractedKnowledge } from './knowledge_extractor.js';

export class Summarizer {
  summarize(items: ExtractedKnowledge[]): string {
    if (items.length === 0) return 'No knowledge extracted.';
    return items
      .slice(0, 6)
      .map((it, idx) => `${idx + 1}. [${it.kind}] ${it.topic}: ${it.summary.replace(/\s+/g, ' ').slice(0, 160)}`)
      .join('\n');
  }
}
