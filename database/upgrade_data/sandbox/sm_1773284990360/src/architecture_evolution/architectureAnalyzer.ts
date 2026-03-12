import path from 'node:path';
import fs from 'node:fs';
import { RepoScanner } from '../code_awareness/repoScanner.js';
import { FileAnalyzer } from '../code_awareness/fileAnalyzer.js';

export interface ArchitectureMetrics {
  dependencies: string[];
  devDependencies: string[];
  oversizedFiles: string[];
  highComplexityModules: string[];
  duplicatePaths: string[];
  circularImports: Array<{ from: string; to: string }>; 
}

export class ArchitectureAnalyzer {
  private readonly scanner = new RepoScanner();
  private readonly analyzer = new FileAnalyzer();

  analyze(root: string): ArchitectureMetrics {
    const scan = this.scanner.scan(root, 2000);
    const files = scan.tree.filter((entry) => entry.type === 'file').map((entry) => entry.path);
    const analysis = this.analyzer.analyze(files, root);
    const oversizedFiles = analysis.filter((a) => a.text.length > 50_000).map((a) => a.relative);
    const highComplexityModules = analysis
      .filter((a) => a.classes.length + a.functions.length > 20)
      .map((a) => a.relative);
    const duplicateMap = new Map<string, number>();
    for (const entry of analysis) {
      const key = `${entry.classes.length}|${entry.functions.length}`;
      duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
    }
    const duplicatePaths = Array.from(duplicateMap.entries())
      .filter(([, count]) => count > 1)
      .map((entry) => `pattern ${entry[0]} repeated ${entry[1]} times`);
    const circularImports = this.detectCircularImports(analysis);
    return {
      dependencies: scan.dependencies,
      devDependencies: scan.devDependencies,
      oversizedFiles,
      highComplexityModules,
      duplicatePaths,
      circularImports,
    };
  }

  private detectCircularImports(analysis: ReturnType<FileAnalyzer['analyze']>): Array<{ from: string; to: string }> {
    const files = analysis;
    const graph = new Map<string, string[]>();
    for (const item of files) {
      graph.set(item.relative, item.imports.map((imp) => imp.replace(/\\\\/g, '/')));
    }
    const cycles: Array<{ from: string; to: string }> = [];
    for (const [node, deps] of graph.entries()) {
      for (const dep of deps) {
        if (graph.get(dep)?.includes(node)) {
          cycles.push({ from: node, to: dep });
        }
      }
    }
    return cycles;
  }
}
