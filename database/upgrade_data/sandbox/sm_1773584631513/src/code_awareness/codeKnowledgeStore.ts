import fs from 'node:fs';
import path from 'node:path';
import { CODE_KNOWLEDGE_DIR } from '../config.js';
import { VectorMemoryStore } from '../memory/vector_store.js';
import type { ArchitectureGraph } from './architectureMapper.js';
import type { FeatureReport } from './featureDetector.js';

const KNOWLEDGE_FILE = path.join(CODE_KNOWLEDGE_DIR, 'code_map.json');

export interface ModuleKnowledge {
  module: string;
  files: string[];
  features: string[];
  status: 'implemented' | 'partial' | 'missing';
  summary: string;
}

export interface KnowledgeSnapshot {
  scanned_at: string;
  modules: ModuleKnowledge[];
  graph: ArchitectureGraph;
  features: FeatureReport;
  dependencies: string[];
  devDependencies: string[];
  configs: string[];
}

export interface SearchResult {
  module: string;
  summary: string;
  score: number;
  source: string;
}

export class CodeKnowledgeStore {
  private readonly vectorStore = new VectorMemoryStore();

  save(snapshot: KnowledgeSnapshot): void {
    fs.mkdirSync(CODE_KNOWLEDGE_DIR, { recursive: true });
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    for (const module of snapshot.modules) {
      this.vectorStore.upsert(module.summary, { module: module.module, source: 'code_awareness' });
    }
  }

  read(): KnowledgeSnapshot | null {
    if (!fs.existsSync(KNOWLEDGE_FILE)) return null;
    try {
      const raw = fs.readFileSync(KNOWLEDGE_FILE, 'utf8');
      return JSON.parse(raw) as KnowledgeSnapshot;
    } catch (err) {
      console.error('Failed to read code knowledge map', err);
      return null;
    }
  }

  features(): FeatureReport {
    return this.read()?.features || { implemented: [], missing: [], details: {} };
  }

  modules(): ModuleKnowledge[] {
    return this.read()?.modules || [];
  }

  search(query: string): SearchResult[] {
    if (!query.trim()) return [];
    const snapshot = this.read();
    if (!snapshot) return [];
    const vector = this.vectorStore.embed(query);
    const hits = this.vectorStore.similaritySearch(vector, 5).map((record) => ({
      module: String(record.metadata?.module || 'unknown'),
      summary: record.text,
      score: 1,
      source: String(record.metadata?.source || 'vector_memory'),
    }));
    const textMatches = snapshot.modules
      .filter((module) => module.module.includes(query) || module.summary.includes(query))
      .map((module) => ({ module: module.module, summary: module.summary, score: 1, source: 'text_match' }));
    const combined = [...textMatches, ...hits];
    const uniqueMap = new Map<string, SearchResult>();
    for (const hit of combined) {
      if (!uniqueMap.has(hit.module)) uniqueMap.set(hit.module, hit);
    }
    return Array.from(uniqueMap.values()).slice(0, 10);
  }
}
