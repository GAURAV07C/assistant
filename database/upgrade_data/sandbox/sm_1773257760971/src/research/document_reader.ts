export class DocumentReader {
  async extractKnowledgeFromDocs(doc: string): Promise<{ concepts: string[]; summary: string }> {
    const text = String(doc || '').toLowerCase();
    const candidates = ['react', 'typescript', 'node', 'api', 'agent', 'memory', 'vector', 'embedding', 'security', 'performance'];
    const concepts = candidates.filter((c) => text.includes(c));
    return {
      concepts,
      summary: String(doc || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    };
  }

  async read(url: string): Promise<{ ok: boolean; text?: string; detail: string }> {
    const target = String(url || '').trim();
    if (!target) return { ok: false, detail: 'url required' };

    try {
      const res = await fetch(target);
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 9000);
      return { ok: true, text, detail: 'document read' };
    } catch (err) {
      return { ok: false, detail: `read failed: ${String(err)}` };
    }
  }
}
