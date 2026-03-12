export class TopicDetector {
  detect(input: { message: string; tags?: string[]; skillHints?: string[] }): string[] {
    const text = `${input.message} ${(input.tags || []).join(' ')} ${(input.skillHints || []).join(' ')}`.toLowerCase();
    const candidates = [
      'vector database',
      'rag',
      'typescript backend',
      'react architecture',
      'agent orchestration',
      'micro model training',
      'safety guardrails',
      'performance optimization',
    ];

    const detected = candidates.filter((topic) => {
      const key = topic.split(' ')[0];
      return text.includes(key) || text.includes(topic.replace(/\s+/g, ''));
    });

    if (/latest|new|trend|research|compare/.test(text) && detected.length === 0) {
      return ['ai engineering trends'];
    }

    return detected.slice(0, 4);
  }
}
