import fs from 'node:fs';
import path from 'node:path';
import { DB_DIR } from '../config.js';

interface GraphNode {
  id: string;
  weight: number;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

interface IntelligenceGraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updated_at: string;
}

const INTELLIGENCE_DIR = path.join(DB_DIR, 'intelligence');
const INTELLIGENCE_GRAPH_FILE = path.join(INTELLIGENCE_DIR, 'intelligence_graph.json');

export class IntelligenceGraph {
  constructor() {
    fs.mkdirSync(INTELLIGENCE_DIR, { recursive: true });
  }

  upsertConcepts(concepts: string[]): void {
    if (concepts.length === 0) return;
    const graph = this.read();
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map(graph.edges.map((e) => [`${e.from}|${e.relation}|${e.to}`, e]));

    const clean = concepts.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean);

    for (const c of clean) {
      const node = nodeMap.get(c) || { id: c, weight: 0 };
      node.weight += 1;
      nodeMap.set(c, node);
    }

    for (let i = 0; i < clean.length - 1; i += 1) {
      const key = `${clean[i]}|related_to|${clean[i + 1]}`;
      const edge = edgeMap.get(key) || { from: clean[i], to: clean[i + 1], relation: 'related_to', weight: 0 };
      edge.weight += 1;
      edgeMap.set(key, edge);
    }

    this.write({
      nodes: Array.from(nodeMap.values()).sort((a, b) => b.weight - a.weight).slice(0, 4000),
      edges: Array.from(edgeMap.values()).sort((a, b) => b.weight - a.weight).slice(0, 9000),
      updated_at: new Date().toISOString(),
    });
  }

  snapshot(): IntelligenceGraphStore {
    return this.read();
  }

  private read(): IntelligenceGraphStore {
    if (!fs.existsSync(INTELLIGENCE_GRAPH_FILE)) return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    try {
      return JSON.parse(fs.readFileSync(INTELLIGENCE_GRAPH_FILE, 'utf8')) as IntelligenceGraphStore;
    } catch {
      return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    }
  }

  private write(value: IntelligenceGraphStore): void {
    fs.writeFileSync(INTELLIGENCE_GRAPH_FILE, JSON.stringify(value, null, 2), 'utf8');
  }
}
