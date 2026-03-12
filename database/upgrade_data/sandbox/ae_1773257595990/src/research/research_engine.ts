import { TAVILY_API_KEYS } from '../config.js';
import type { StructuredInsight } from '../learning/knowledge_extractor.js';

export interface ResearchInsight {
  concept: string;
  summary: string;
  sources: string[];
}

export class ResearchEngine {
  private tavilyKeys: string[];

  constructor(tavilyKeys?: string[]) {
    const fromInput = Array.isArray(tavilyKeys) ? tavilyKeys : TAVILY_API_KEYS;
    this.tavilyKeys = Array.from(new Set((fromInput || []).map((k) => String(k || '').trim()).filter(Boolean)));
  }

  updateTavilyKeys(keys: string[]): number {
    this.tavilyKeys = Array.from(new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean)));
    return this.tavilyKeys.length;
  }

  async autonomousWebSearch(query: string): Promise<ResearchInsight | null> {
    return this.expandConcept(query);
  }

  async expandConcept(concept: string): Promise<ResearchInsight | null> {
    const q = String(concept || '').trim();
    if (!q || this.tavilyKeys.length === 0) return null;

    for (const key of this.tavilyKeys) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: key,
            query: q,
            search_depth: 'advanced',
            max_results: 5,
            include_answer: true,
            include_raw_content: false,
          }),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          answer?: string;
          results?: Array<{ url?: string; title?: string; content?: string }>;
        };
        const answer = String(data.answer || '').trim();
        const sources = (data.results || []).map((r) => String(r.url || '').trim()).filter(Boolean).slice(0, 6);
        if (!answer && sources.length === 0) continue;
        return {
          concept: q,
          summary: answer || `Research data retrieved for ${q}.`,
          sources,
        };
      } catch {
        // try next key
      }
    }
    return null;
  }

  shouldExpand(insights: StructuredInsight[]): string[] {
    const freq = new Map<string, number>();
    for (const it of insights) {
      const key = it.topic.toLowerCase();
      freq.set(key, (freq.get(key) || 0) + 1);
    }
    return Array.from(freq.entries())
      .filter(([, n]) => n >= 3)
      .map(([topic]) => topic)
      .slice(0, 4);
  }

  linkFactsAndConcepts(input: { concept: string; sources: string[]; summary: string }): { concept: string; linked_sources: number; summary: string } {
    return {
      concept: input.concept,
      linked_sources: (input.sources || []).length,
      summary: input.summary,
    };
  }
}
