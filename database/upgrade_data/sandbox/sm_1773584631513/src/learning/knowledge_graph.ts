import fs from 'node:fs';
import { KNOWLEDGE_GRAPH_FILE } from '../config.js';
import type { StructuredInsight } from './knowledge_extractor.js';

interface GraphNode {
  id: string;
  label: string;
  count: number;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  count: number;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updated_at: string;
}

function conceptsFromText(text: string): string[] {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4)
    .slice(0, 120);

  const allow = ['agent', 'vector', 'database', 'embeddings', 'llm', 'memory', 'architecture', 'api', 'react', 'reasoning', 'security', 'performance'];
  const found = new Set<string>();
  for (const t of tokens) {
    if (allow.includes(t)) found.add(t);
  }
  return Array.from(found);
}

export class KnowledgeGraph {
  private readGraph(): KnowledgeGraphData {
    if (!fs.existsSync(KNOWLEDGE_GRAPH_FILE)) {
      return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    }
    try {
      return JSON.parse(fs.readFileSync(KNOWLEDGE_GRAPH_FILE, 'utf8')) as KnowledgeGraphData;
    } catch {
      return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    }
  }

  private writeGraph(data: KnowledgeGraphData): void {
    data.updated_at = new Date().toISOString();
    fs.writeFileSync(KNOWLEDGE_GRAPH_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  updateFromInsights(insights: StructuredInsight[]): void {
    if (insights.length === 0) return;
    const data = this.readGraph();
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map(data.edges.map((e) => [`${e.from}|${e.relation}|${e.to}`, e]));

    for (const ins of insights) {
      const concepts = conceptsFromText(`${ins.topic}\n${ins.summary}`);
      for (const concept of concepts) {
        const n = nodeMap.get(concept) || { id: concept, label: concept, count: 0 };
        n.count += 1;
        nodeMap.set(concept, n);
      }
      for (let i = 0; i < concepts.length - 1; i += 1) {
        const from = concepts[i];
        const to = concepts[i + 1];
        const relation = 'related_to';
        const key = `${from}|${relation}|${to}`;
        const e = edgeMap.get(key) || { from, to, relation, count: 0 };
        e.count += 1;
        edgeMap.set(key, e);
      }
    }

    data.nodes = Array.from(nodeMap.values()).sort((a, b) => b.count - a.count).slice(0, 2000);
    data.edges = Array.from(edgeMap.values()).sort((a, b) => b.count - a.count).slice(0, 5000);
    this.writeGraph(data);
  }
}
