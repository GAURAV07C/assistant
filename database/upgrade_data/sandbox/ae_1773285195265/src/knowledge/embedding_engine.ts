export interface KnowledgeVector {
  id: string;
  topic: string;
  vector: number[];
  summary: string;
}

function hashToken(token: string, dim: number): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) h = (h ^ token.charCodeAt(i)) * 16777619;
  return Math.abs(h) % dim;
}

function toVector(text: string, dim = 96): number[] {
  const tokens = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 300);
  const vec = new Array(dim).fill(0);
  for (const t of tokens) vec[hashToken(t, dim)] += 1;
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export class KnowledgeEmbeddingEngine {
  embed(id: string, topic: string, summary: string): KnowledgeVector {
    return {
      id,
      topic,
      summary,
      vector: toVector(`${topic}\n${summary}`),
    };
  }
}
