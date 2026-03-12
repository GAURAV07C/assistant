import fs from 'node:fs';
import path from 'node:path';
import { SKILL_PROGRESS_DIR } from '../config.js';

export interface SkillNode {
  name: string;
  score: number;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface SkillGraph {
  nodes: SkillNode[];
  edges: Array<{ from: string; to: string; weight: number }>;
  updated_at: string;
}

const SKILL_GRAPH_FILE = path.join(SKILL_PROGRESS_DIR, 'skill_graph.json');

function toLevel(score: number): SkillNode['level'] {
  if (score >= 70) return 'advanced';
  if (score >= 35) return 'intermediate';
  return 'beginner';
}

export class SkillTracker {
  private read(): SkillGraph {
    if (!fs.existsSync(SKILL_GRAPH_FILE)) return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    try {
      return JSON.parse(fs.readFileSync(SKILL_GRAPH_FILE, 'utf8')) as SkillGraph;
    } catch {
      return { nodes: [], edges: [], updated_at: new Date().toISOString() };
    }
  }

  private write(graph: SkillGraph): void {
    graph.updated_at = new Date().toISOString();
    fs.writeFileSync(SKILL_GRAPH_FILE, JSON.stringify(graph, null, 2), 'utf8');
  }

  trackSession(input: { message: string; response: string; intent: string }): SkillGraph {
    const graph = this.read();
    const map = new Map(graph.nodes.map((n) => [n.name, n]));
    const text = `${input.message}\n${input.response}`.toLowerCase();

    const skillBoosts: Array<{ name: string; score: number }> = [
      { name: 'typescript', score: /\btypescript|ts\b/.test(text) ? 4 : 0 },
      { name: 'react', score: /\breact|component|hook\b/.test(text) ? 4 : 0 },
      { name: 'api_design', score: /\bapi|endpoint|rest|graphql\b/.test(text) ? 4 : 0 },
      { name: 'debugging', score: /\bdebug|bug|error|fix\b/.test(text) ? 5 : 0 },
      { name: 'system_design', score: /\barchitecture|scalable|distributed|tradeoff\b/.test(text) ? 5 : 0 },
      { name: 'automation', score: /\bscript|pipeline|automation|terminal\b/.test(text) ? 4 : 0 },
      { name: 'research', score: /\bresearch|compare|latest|sources\b/.test(text) ? 3 : 0 },
    ];

    for (const item of skillBoosts) {
      if (item.score <= 0) continue;
      const prev = map.get(item.name) || { name: item.name, score: 0, level: 'beginner' as const };
      const nextScore = Math.min(100, prev.score + item.score);
      map.set(item.name, { name: item.name, score: nextScore, level: toLevel(nextScore) });
    }

    const updatedNodes = Array.from(map.values()).sort((a, b) => b.score - a.score);
    const edges: SkillGraph['edges'] = [];
    for (let i = 0; i < updatedNodes.length - 1; i += 1) {
      edges.push({ from: updatedNodes[i].name, to: updatedNodes[i + 1].name, weight: Math.max(1, Math.round((updatedNodes[i].score + updatedNodes[i + 1].score) / 20)) });
    }

    const next: SkillGraph = { nodes: updatedNodes, edges, updated_at: new Date().toISOString() };
    this.write(next);
    return next;
  }

  snapshot(): SkillGraph {
    return this.read();
  }
}
