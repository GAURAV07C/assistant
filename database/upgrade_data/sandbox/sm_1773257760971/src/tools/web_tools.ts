import { TAVILY_API_KEYS } from '../config.js';

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export class WebTools {
  private tavilyKeys = Array.from(new Set((TAVILY_API_KEYS || []).map((k) => String(k || '').trim()).filter(Boolean)));

  async search(query: string, maxResults = 5): Promise<{ ok: boolean; results: WebSearchResult[]; detail: string }> {
    if (!this.tavilyKeys.length) {
      return { ok: false, results: [], detail: 'TAVILY_API_KEY missing' };
    }
    let lastErr = 'Unknown Tavily failure';
    for (const key of this.tavilyKeys) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: key,
            query,
            max_results: Math.max(1, Math.min(10, maxResults)),
            search_depth: 'advanced',
            include_answer: false,
            include_raw_content: false,
          }),
        });
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          continue;
        }
        const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
        const results = (data.results || []).map((r) => ({
          title: String(r.title || 'Untitled'),
          url: String(r.url || ''),
          content: String(r.content || '').slice(0, 600),
        }));
        return { ok: true, results, detail: `Found ${results.length} results` };
      } catch (err) {
        lastErr = `Search failed: ${String(err)}`;
      }
    }
    return { ok: false, results: [], detail: lastErr };
  }

  async readUrl(url: string): Promise<{ ok: boolean; text?: string; detail: string }> {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      const text = await res.text();
      return { ok: true, text: text.slice(0, 8000), detail: 'URL fetched' };
    } catch (err) {
      return { ok: false, detail: `readUrl failed: ${String(err)}` };
    }
  }
}
