import { KnowledgeCompressor } from '../knowledge/knowledge_compressor.js';
import { DocumentReader } from './document_reader.js';
import { WebResearcher } from './web_researcher.js';

export class KnowledgeBuilder {
  private readonly researcher = new WebResearcher();
  private readonly reader = new DocumentReader();
  private readonly compressor = new KnowledgeCompressor();

  async detectAndBuild(query: string): Promise<{ built: boolean; detail: string }> {
    const text = String(query || '').toLowerCase();
    const isGapLike = /\b(unknown|latest|compare|research|how does|what is)\b/.test(text);
    if (!isGapLike) return { built: false, detail: 'No obvious knowledge gap detected' };

    const evidence = await this.researcher.explore(query, 4);
    if (!evidence || evidence.sources.length === 0) return { built: false, detail: 'No research evidence found' };

    const firstUrl = evidence.sources.find((s) => !!s.url)?.url;
    let docText = '';
    if (firstUrl) {
      const read = await this.reader.read(firstUrl);
      if (read.ok && read.text) docText = read.text;
    }

    const summary = evidence.sources
      .slice(0, 3)
      .map((s, i) => `${i + 1}. ${s.title} - ${s.snippet}`)
      .join('\n');

    this.compressor.compressInteraction({
      timestamp: new Date().toISOString(),
      user_message: query,
      assistant_response: `${summary}\n\n${docText.slice(0, 1200)}`,
      tags: ['research', 'knowledge_builder'],
    });

    return { built: true, detail: `Knowledge built from ${evidence.sources.length} source(s)` };
  }

  updateKnowledgeGraph(concepts: string[]): { linked: number; concepts: string[] } {
    const unique = Array.from(new Set((concepts || []).map((c) => String(c || '').trim()).filter(Boolean)));
    this.compressor.compressInteraction({
      timestamp: new Date().toISOString(),
      user_message: `Knowledge graph update: ${unique.join(', ')}`,
      assistant_response: `Linked concepts: ${unique.join(', ')}`,
      tags: ['knowledge_graph_update'],
    });
    return { linked: unique.length, concepts: unique };
  }

  linkFactsAndConcepts(facts: string[], concepts: string[]): { links: Array<{ fact: string; concept: string }> } {
    const links: Array<{ fact: string; concept: string }> = [];
    for (const fact of facts.slice(0, 20)) {
      for (const concept of concepts.slice(0, 20)) {
        if (String(fact).toLowerCase().includes(String(concept).toLowerCase())) {
          links.push({ fact: String(fact), concept: String(concept) });
        }
      }
    }
    return { links };
  }
}
