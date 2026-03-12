import type { VectorRecord } from './vector_store.js';

export class ContextBuilder {
  build(retrieved: VectorRecord[], maxChars = 2400): string {
    if (!retrieved.length) return '';
    const chunks: string[] = [];
    let used = 0;
    for (const r of retrieved) {
      const line = `- (${r.ts}) ${String(r.text || '').replace(/\s+/g, ' ').slice(0, 420)}`;
      if ((used + line.length) > maxChars) break;
      used += line.length;
      chunks.push(line);
    }
    if (!chunks.length) return '';
    return ['Retrieved semantic context from vector memory:', ...chunks].join('\n');
  }
}
