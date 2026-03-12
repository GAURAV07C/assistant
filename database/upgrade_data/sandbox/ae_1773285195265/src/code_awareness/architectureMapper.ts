import path from 'node:path';
import type { FileAnalysis } from './fileAnalyzer.js';

export interface ArchitectureNode {
  module: string;
  path: string;
  imports: string[];
  dependents: string[];
}

export interface ArchitectureGraph {
  nodes: ArchitectureNode[];
  edges: Array<{ from: string; to: string }>;
}

export class ArchitectureMapper {
  map(analysis: FileAnalysis[], root: string): ArchitectureGraph {
    const nodeMap = new Map<string, ArchitectureNode>();

    for (const file of analysis) {
      const key = this.normalizeModule(file.path, root);
      const imports = Array.from(new Set(file.imports.map((i) => this.normalizeImport(i, file.path, root)))).filter(Boolean);
      nodeMap.set(key, { module: key, path: file.relative, imports, dependents: [] });
    }

    const edges: Array<{ from: string; to: string }> = [];
    for (const node of nodeMap.values()) {
      for (const target of node.imports) {
        edges.push({ from: node.module, to: target });
        const child = nodeMap.get(target);
        if (child && !child.dependents.includes(node.module)) {
          child.dependents.push(node.module);
        }
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }

  private normalizeModule(filePath: string, root: string): string {
    return path.relative(root, filePath).replace(/\\\\/g, '/');
  }

  private normalizeImport(raw: string, from: string, root: string): string {
    if (!raw) return '';
    if (raw.startsWith('.')) {
      try {
        const resolved = path.resolve(path.dirname(from), raw);
        return path.relative(root, resolved).replace(/\\\\/g, '/');
      } catch (err) {
        return raw;
      }
    }
    return raw;
  }
}
