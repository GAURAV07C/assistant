import { TAVILY_API_KEYS } from '../config.js';

export interface WebEvidence {
  query: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
}

export class WebResearcher {
  private tavilyKeys = Array.from(new Set((TAVILY_API_KEYS || []).map((k) => String(k || '').trim()).filter(Boolean)));

  async autonomousWebSearch(query: string, maxResults = 6): Promise<WebEvidence | null> {
    return this.explore(query, maxResults);
  }

  async explore(query: string, maxResults = 6): Promise<WebEvidence | null> {
    const q = String(query || '').trim();
    if (!q || !this.tavilyKeys.length) return null;

    for (const key of this.tavilyKeys) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: key,
            query: q,
            search_depth: 'advanced',
            max_results: Math.max(1, Math.min(10, maxResults)),
            include_answer: false,
            include_raw_content: false,
          }),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
        const sources = (data.results || []).map((r) => ({
          title: String(r.title || 'Untitled'),
          url: String(r.url || ''),
          snippet: String(r.content || '').slice(0, 360),
        }));
        return { query: q, sources };
      } catch {
        // try next key
      }
    }
    return null;
  }
}
