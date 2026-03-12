export interface MultimodalKnowledge {
  source_type: string;
  description: string;
  visual_concepts: string[];
  architecture: string;
  code_patterns: string[];
  ui_components: string[];
  summary: string;
}

export class MultimodalKnowledgeExtractor {
  extract(params: {
    type: string;
    content: string;
    visual: { concepts: string[]; diagrams: string[] };
    code: { patterns: string[]; components: string[] };
  }): MultimodalKnowledge {
    const summary = `${params.content.slice(0, 120)} ${params.visual.concepts.join(' ')} ${params.code.patterns.join(' ')}`.trim();
    return {
      source_type: params.type,
      description: params.content.slice(0, 220),
      visual_concepts: params.visual.concepts,
      architecture: params.visual.diagrams.join(' | '),
      code_patterns: params.code.patterns,
      ui_components: params.code.components,
      summary: summary.slice(0, 400),
    };
  }
}
