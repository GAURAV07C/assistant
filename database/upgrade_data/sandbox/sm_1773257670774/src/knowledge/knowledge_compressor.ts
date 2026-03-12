import fs from 'node:fs';
import path from 'node:path';
import { DB_DIR } from '../config.js';
import { KnowledgeEmbeddingEngine } from './embedding_engine.js';
import { KnowledgeExtractor, type RawInteraction } from './knowledge_extractor.js';
import { Summarizer } from './summarizer.js';

interface CompressedStoreItem {
  ts: string;
  summary: string;
  vectors: Array<{ id: string; topic: string; summary: string }>;
}

interface KnowledgeGraphStore {
  nodes: Array<{ id: string; count: number }>;
  edges: Array<{ from: string; to: string; relation: string; count: number }>;
  updated_at: string;
}

const KNOWLEDGE_DIR = path.join(DB_DIR, 'knowledge');
const COMPRESSED_FILE = path.join(KNOWLEDGE_DIR, 'compressed_knowledge.jsonl');
const GRAPH_FILE = path.join(KNOWLEDGE_DIR, 'knowledge_graph.json');

export class KnowledgeCompressor {
  private readonly extractor = new KnowledgeExtractor();
  private readonly summarizer = new Summarizer();
  private readonly embedding = new KnowledgeEmbeddingEngine();

  constructor() {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  compressInteraction(interaction: RawInteraction): { summary: string; items: number } {
    const extracted = this.extractor.extract(interaction);
    const summary = this.summarizer.summarize(extracted);
    const vectors = extracted.map((it, idx) => this.embedding.embed(`${interaction.timestamp}:${idx}`, it.topic, it.summary));

    const item: CompressedStoreItem = {
      ts: interaction.timestamp,
      summary,
      vectors: vectors.map((v) => ({ id: v.id, topic: v.topic, summary: v.summary.slice(0, 240) })),
    };

    fs.appendFileSync(COMPRESSED_FILE, `${JSON.stringify(item)}\n`, 'utf8');
    this.updateGraph(extracted.map((e) => e.topic));
    return { summary, items: extracted.length };
  }

  private updateGraph(topics: string[]): void {
    if (topics.length === 0) return;
    const graph = this.readGraph();
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map(graph.edges.map((e) => [`${e.from}|${e.relation}|${e.to}`, e]));

    for (const topic of topics) {
      const id = String(topic || 'general').toLowerCase();
      const node = nodeMap.get(id) || { id, count: 0 };
      node.count += 1;
      nodeMap.set(id, node);
    }

    for (let i = 0; i < topics.length - 1; i += 1) {
      const from = String(topics[i] || 'general').toLowerCase();
      const to = String(topics[i + 1] || 'general').toLowerCase();
      const key = `${from}|related_to|${to}`;
      const edge = edgeMap.get(key) || { from, to, relation: 'related_to', count: 0 };
      edge.count += 1;
      edgeMap.set(key, edge);
    }

    const next: KnowledgeGraphStore = {
      nodes: Array.from(nodeMap.values()).sort((a, b) => b.count - a.count).slice(0, 2000),
      edges: Array.from(edgeMap.values()).sort((a, b) => b.count - a.count).slice(0, 5000),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(next, null, 2), 'utf8');
  }

  private readGraph(): KnowledgeGraphStore {
    if (!fs.existsSync(GRAPH_FILE)) {
      return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    }
    try {
      return JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8')) as KnowledgeGraphStore;
    } catch {
      return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    }
  }
}
