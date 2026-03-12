import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const VECTOR_FILE = path.join(UPGRADE_DATA_DIR, 'vector_memory_store.json');
const VECTOR_DIM = 64;

export interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  ts: string;
}

export class VectorMemoryStore {
  private read(): VectorRecord[] {
    if (!fs.existsSync(VECTOR_FILE)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(VECTOR_FILE, 'utf8')) as unknown;
      return Array.isArray(parsed) ? (parsed as VectorRecord[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: VectorRecord[]): void {
    fs.mkdirSync(path.dirname(VECTOR_FILE), { recursive: true });
    fs.writeFileSync(VECTOR_FILE, JSON.stringify(items.slice(-4000), null, 2), 'utf8');
  }

  embed(text: string): number[] {
    const vec = new Array<number>(VECTOR_DIM).fill(0);
    const input = String(text || '').toLowerCase();
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      vec[(code + i) % VECTOR_DIM] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + (v * v), 0)) || 1;
    return vec.map((v) => v / norm);
  }

  upsert(text: string, metadata?: Record<string, unknown>): VectorRecord {
    const items = this.read();
    const record: VectorRecord = {
      id: `vm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: String(text || '').slice(0, 6000),
      embedding: this.embed(text),
      metadata,
      ts: new Date().toISOString(),
    };
    items.push(record);
    this.write(items);
    return record;
  }

  similaritySearch(queryEmbedding: number[], topK = 5): VectorRecord[] {
    const all = this.read();
    const scored = all.map((item) => ({ item, score: this.cosine(queryEmbedding, item.embedding || []) }));
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(20, topK)))
      .map((s) => s.item);
  }

  stats() {
    const all = this.read();
    return {
      total_vectors: all.length,
      latest_update: all.length ? all[all.length - 1].ts : null,
    };
  }

  private cosine(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const den = Math.sqrt(na) * Math.sqrt(nb);
    if (!den) return 0;
    return dot / den;
  }
}
