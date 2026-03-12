export interface MistakePattern {
  name: string;
  frequency: number;
}

export class MistakeDetector {
  detect(input: {
    reflection_comments: string[];
    failed_steps: Array<{ step: string; tool: string }>;
  }): MistakePattern[] {
    const counter = new Map<string, number>();

    for (const comment of input.reflection_comments) {
      const text = String(comment || '').toLowerCase();
      if (/missing context|unclear/.test(text)) counter.set('missing_context', (counter.get('missing_context') || 0) + 1);
      if (/edge case|validation/.test(text)) counter.set('edge_case_gap', (counter.get('edge_case_gap') || 0) + 1);
      if (/reasoning shallow|weak reasoning/.test(text)) counter.set('reasoning_shallow', (counter.get('reasoning_shallow') || 0) + 1);
    }

    for (const step of input.failed_steps) {
      const key = `tool_failure_${step.tool}`;
      counter.set(key, (counter.get(key) || 0) + 1);
    }

    return Array.from(counter.entries())
      .map(([name, frequency]) => ({ name, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8);
  }
}
