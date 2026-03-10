export interface VideoKnowledge {
  video_title: string;
  channel: string;
  concepts: string[];
  steps: string[];
  code_examples: string[];
  summary: string;
}

export class VideoKnowledgeExtractor {
  extract(videoMeta: { title: string; channel: string }, transcript: string[]): VideoKnowledge {
    const concepts = this.detectConcepts(transcript);
    const steps = this.detectSteps(transcript);
    const code_examples = this.detectCode(transcript);
    const summary = this.summarize(transcript);

    return {
      video_title: videoMeta.title,
      channel: videoMeta.channel,
      concepts,
      steps,
      code_examples,
      summary,
    };
  }

  private detectConcepts(paragraphs: string[]): string[] {
    const keywords = new Set<string>();
    for (const para of paragraphs) {
      const tokens = para.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
      for (const token of tokens) {
        if (/tutorial|architecture|api|service|component|workflow|diagram/.test(token)) keywords.add(token);
      }
    }
    return Array.from(keywords).slice(0, 6);
  }

  private detectSteps(paragraphs: string[]): string[] {
    const out: string[] = [];
    for (const para of paragraphs) {
      if (/step\s*\d+/i.test(para) || para.toLowerCase().startsWith('first')) {
        out.push(para.slice(0, 200));
      }
    }
    if (!out.length) {
      const slice = paragraphs.slice(0, 3).map((p) => p.slice(0, 160));
      return slice;
    }
    return out.slice(0, 6);
  }

  private detectCode(paragraphs: string[]): string[] {
    const codes: string[] = [];
    for (const para of paragraphs) {
      if (/\bconst |function |class |import |def |public |private /.test(para)) {
        codes.push(para.slice(0, 200));
      }
    }
    return codes.slice(0, 4);
  }

  private summarize(paragraphs: string[]): string {
    const all = paragraphs.join(' ');
    return all.split('.').slice(0, 2).join('.').trim();
  }
}
