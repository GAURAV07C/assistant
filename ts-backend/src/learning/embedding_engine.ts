import fs from 'node:fs';
import { EMBEDDINGS_FILE } from '../config.js';
import type { StructuredInsight } from './knowledge_extractor.js';

interface EmbeddingItem {
  id: string;
  timestamp: string;
  topic: string;
  summary: string;
  vector: number[];
}

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 300);
}

function hashToken(token: string, dim: number): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) h = (h ^ token.charCodeAt(i)) * 16777619;
  return Math.abs(h) % dim;
}

function vectorize(text: string, dim = 128): number[] {
  const v = new Array(dim).fill(0);
  const tokens = tokenize(text);
  for (const t of tokens) v[hashToken(t, dim)] += 1;
  const norm = Math.sqrt(v.reduce((acc, n) => acc + n * n, 0)) || 1;
  return v.map((n) => n / norm);
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < len; i += 1) d += a[i] * b[i];
  return d;
}

export class EmbeddingEngine {
  private readAll(): EmbeddingItem[] {
    if (!fs.existsSync(EMBEDDINGS_FILE)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf8')) as { items?: EmbeddingItem[] };
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  private writeAll(items: EmbeddingItem[]): void {
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify({ items }, null, 2), 'utf8');
  }

  upsertInsights(insights: StructuredInsight[]): void {
    if (insights.length === 0) return;
    const existing = this.readAll();
    const index = new Map(existing.map((i) => [i.id, i]));
    for (const ins of insights) {
      const id = `${ins.session_id}:${ins.timestamp}:${ins.kind}`;
      index.set(id, {
        id,
        timestamp: ins.timestamp,
        topic: ins.topic,
        summary: ins.summary,
        vector: vectorize(`${ins.topic}\n${ins.summary}`),
      });
    }
    this.writeAll(Array.from(index.values()).slice(-5000));
  }

  semanticRetrieve(query: string, topK = 5): Array<{ topic: string; summary: string; score: number }> {
    const all = this.readAll();
    if (all.length === 0) return [];
    const qVec = vectorize(query);
    return all
      .map((it) => ({ topic: it.topic, summary: it.summary, score: cosine(qVec, it.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
