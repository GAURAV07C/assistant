import fs from 'node:fs';
import path from 'node:path';
import {
  DATASET_CODING_PATTERNS_DIR,
  DATASET_REASONING_EXAMPLES_DIR,
  DATASET_KNOWLEDGE_SUMMARIES_DIR,
  TRAINING_EXPORTS_DIR,
} from '../config.js';

interface DatasetItem {
  input: string;
  context: string;
  expected_output: string;
  tags: string[];
}

export class TrainingDatasetBuilder {
  buildUnifiedExport(): { count: number; output_file: string } {
    const dirs = [DATASET_CODING_PATTERNS_DIR, DATASET_REASONING_EXAMPLES_DIR, DATASET_KNOWLEDGE_SUMMARIES_DIR];
    const items: DatasetItem[] = [];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
      for (const file of files) {
        const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as DatasetItem;
            if (!parsed.input || !parsed.expected_output) continue;
            items.push({
              input: String(parsed.input).slice(0, 2000),
              context: String(parsed.context || '').slice(0, 1000),
              expected_output: String(parsed.expected_output).slice(0, 2500),
              tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 12) : [],
            });
          } catch {
            // ignore malformed line
          }
        }
      }
    }

    const outFile = path.join(TRAINING_EXPORTS_DIR, 'micro_unified_dataset.json');
    fs.writeFileSync(outFile, JSON.stringify({ generated_at: new Date().toISOString(), count: items.length, items }, null, 2), 'utf8');
    return { count: items.length, output_file: outFile };
  }
}
