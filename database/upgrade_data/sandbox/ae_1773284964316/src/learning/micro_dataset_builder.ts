import fs from 'node:fs';
import path from 'node:path';
import {
  DATASET_CODING_PATTERNS_DIR,
  DATASET_KNOWLEDGE_SUMMARIES_DIR,
  DATASET_REASONING_EXAMPLES_DIR,
  DATASET_USER_STYLE_DIR,
  TRAINING_EXPORT_CODING_FILE,
  TRAINING_EXPORT_KNOWLEDGE_FILE,
  TRAINING_EXPORT_REASONING_FILE,
} from '../config.js';
import type { ConversationRecord } from './dataset_manager.js';
import type { StructuredInsight } from './knowledge_extractor.js';

export interface MicroDatasetItem {
  input: string;
  context: string;
  expected_output: string;
  tags: string[];
}

function appendJsonl(filePath: string, item: MicroDatasetItem): void {
  fs.appendFileSync(filePath, `${JSON.stringify(item)}\n`, 'utf8');
}

function sanitizeText(v: string, max: number): string {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function dedupe(items: MicroDatasetItem[]): MicroDatasetItem[] {
  const seen = new Set<string>();
  const out: MicroDatasetItem[] = [];
  for (const it of items) {
    const key = `${it.input.slice(0, 120)}|${it.expected_output.slice(0, 120)}|${it.tags.join(',')}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export class MicroDatasetBuilder {
  constructor() {
    fs.mkdirSync(DATASET_CODING_PATTERNS_DIR, { recursive: true });
    fs.mkdirSync(DATASET_REASONING_EXAMPLES_DIR, { recursive: true });
    fs.mkdirSync(DATASET_KNOWLEDGE_SUMMARIES_DIR, { recursive: true });
    fs.mkdirSync(DATASET_USER_STYLE_DIR, { recursive: true });
  }

  build(records: ConversationRecord[], insights: StructuredInsight[]): void {
    if (records.length === 0 && insights.length === 0) return;

    const coding: MicroDatasetItem[] = [];
    const reasoning: MicroDatasetItem[] = [];
    const knowledge: MicroDatasetItem[] = [];
    const userStyle: MicroDatasetItem[] = [];

    for (const rec of records) {
      const tags = (rec.tags || []).map((t) => String(t || '').toLowerCase());
      const base: MicroDatasetItem = {
        input: sanitizeText(rec.user_message, 2000),
        context: sanitizeText(rec.coding_context || rec.detected_topic || 'general', 1200),
        expected_output: sanitizeText(rec.assistant_response, 3000),
        tags: tags.slice(0, 12),
      };
      if (tags.includes('coding') || /\b(code|bug|refactor|typescript|react|api)\b/i.test(rec.user_message || '')) coding.push(base);
      if (tags.includes('research') || /\b(why|tradeoff|architecture|design|compare|complexity)\b/i.test(rec.user_message || '')) reasoning.push(base);
      if (/\b(prefer|style|indent|semicolon|quotes?|concise|detailed)\b/i.test(rec.user_message || '')) userStyle.push(base);
    }

    for (const ins of insights) {
      const item: MicroDatasetItem = {
        input: sanitizeText(`${ins.kind}: ${ins.topic}`, 800),
        context: sanitizeText(ins.source_tags.join(', '), 600),
        expected_output: sanitizeText(ins.summary, 2200),
        tags: Array.from(new Set([ins.kind, ins.topic, ...ins.source_tags])).slice(0, 12),
      };
      knowledge.push(item);
      if (ins.kind === 'coding_pattern' || ins.kind === 'bug_fix') coding.push(item);
      if (ins.kind === 'problem_solving' || ins.kind === 'architecture_idea') reasoning.push(item);
      if (ins.kind === 'preference') userStyle.push(item);
    }

    const day = new Date().toISOString().slice(0, 10);
    const codingFile = path.join(DATASET_CODING_PATTERNS_DIR, `${day}.jsonl`);
    const reasoningFile = path.join(DATASET_REASONING_EXAMPLES_DIR, `${day}.jsonl`);
    const knowledgeFile = path.join(DATASET_KNOWLEDGE_SUMMARIES_DIR, `${day}.jsonl`);
    const styleFile = path.join(DATASET_USER_STYLE_DIR, `${day}.jsonl`);

    for (const item of dedupe(coding)) appendJsonl(codingFile, item);
    for (const item of dedupe(reasoning)) appendJsonl(reasoningFile, item);
    for (const item of dedupe(knowledge)) appendJsonl(knowledgeFile, item);
    for (const item of dedupe(userStyle)) appendJsonl(styleFile, item);

    this.exportTrainingJson();
  }

  exportTrainingJson(): void {
    this.exportCategory(DATASET_CODING_PATTERNS_DIR, TRAINING_EXPORT_CODING_FILE);
    this.exportCategory(DATASET_REASONING_EXAMPLES_DIR, TRAINING_EXPORT_REASONING_FILE);
    this.exportCategory(DATASET_KNOWLEDGE_SUMMARIES_DIR, TRAINING_EXPORT_KNOWLEDGE_FILE);
  }

  private exportCategory(dir: string, outFile: string): void {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
    const items: MicroDatasetItem[] = [];
    for (const f of files) {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as MicroDatasetItem;
          if (!parsed.input || !parsed.expected_output) continue;
          items.push(parsed);
        } catch {
          // skip malformed line
        }
      }
    }
    fs.writeFileSync(outFile, JSON.stringify({ generated_at: new Date().toISOString(), count: items.length, items: dedupe(items) }, null, 2), 'utf8');
  }
}
