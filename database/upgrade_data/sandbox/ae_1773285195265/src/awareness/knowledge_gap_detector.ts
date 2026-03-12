export class KnowledgeGapDetector {
  detect(input: {
    request: string;
    response: string;
    knownConcepts: string[];
    researchTopics?: string[];
  }): string[] {
    const known = new Set((input.knownConcepts || []).map((k) => String(k || '').toLowerCase()));
    const text = `${input.request} ${input.response}`;

    const extracted = this.extractCandidateConcepts(text);
    const gaps = extracted.filter((c) => !known.has(c.toLowerCase()));

    for (const topic of input.researchTopics || []) {
      if (!known.has(topic.toLowerCase())) gaps.push(topic);
    }

    return Array.from(new Set(gaps)).slice(0, 10);
  }

  private extractCandidateConcepts(text: string): string[] {
    const normalized = String(text || '')
      .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4)
      .slice(0, 240);

    const keywords = normalized.filter((t) => {
      const w = t.toLowerCase();
      return /agent|reason|llm|vector|graph|embedding|typescript|react|backend|api|scheduler|orchestrator|security|research|curriculum|reflection|learning|skill/.test(w);
    });

    return Array.from(new Set(keywords.map((k) => k.toLowerCase()))).slice(0, 15);
  }
}
