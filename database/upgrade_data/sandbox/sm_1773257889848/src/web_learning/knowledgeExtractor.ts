export interface WebKnowledge {
  url: string;
  title: string;
  concepts: string[];
  explanations: string[];
  code_examples: string[];
  steps: string[];
  summary: string;
}

export class KnowledgeExtractor {
  extract(url: string, title: string, sections: string[], text: string, codeBlocks: string[]): WebKnowledge {
    const concepts = this.extractConcepts(text);
    const explanations = sections.slice(0, 4);
    const steps = this.extractSteps(sections, text);
    const summary = this.buildSummary(text);
    return { url, title, concepts, explanations, code_examples: codeBlocks, steps, summary };
  }

  private extractConcepts(text: string): string[] {
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 4);
    const allow = ['architecture', 'api', 'service', 'endpoint', 'component', 'workflow', 'diagram', 'token', 'vector'];
    const unique = Array.from(new Set(tokens.filter((t) => allow.includes(t))));
    return unique.slice(0, 6);
  }

  private extractSteps(sections: string[], text: string): string[] {
    const steps: string[] = [];
    for (const section of sections) {
      if (/step\s*\d+/i.test(section) || /tutorial/i.test(section)) {
        steps.push(section.slice(0, 200));
      }
    }
    if (!steps.length) {
      steps.push(...text.split('.').slice(0, 3).map((s) => s.trim()).filter(Boolean));
    }
    return steps.slice(0, 5);
  }

  private buildSummary(text: string): string {
    return text.split('.').slice(0, 2).join('.').trim();
  }
}
