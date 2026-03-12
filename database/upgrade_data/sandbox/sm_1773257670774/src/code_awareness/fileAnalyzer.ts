import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export interface FileAnalysis {
  path: string;
  relative: string;
  classes: string[];
  functions: string[];
  exports: string[];
  apiRoutes: string[];
  imports: string[];
  text: string;
}

export class FileAnalyzer {
  analyze(fileCandidates: string[], root: string): FileAnalysis[] {
    return fileCandidates
      .filter((file) => this.isSupported(file))
      .map((file) => this.analyzeFile(file, root));
  }

  private analyzeFile(file: string, root: string): FileAnalysis {
    const content = fs.readFileSync(file, 'utf8');
    return {
      path: file,
      relative: path.relative(root, file).replace(/\\\\/g, '/'),
      classes: this.extract(content, /class\s+([A-Za-z0-9_]+)/g),
      functions: this.extract(content, /function\s+([A-Za-z0-9_]+)/g)
        .concat(this.extract(content, /const\s+([A-Za-z0-9_]+)\s*=\s*\(/g))
        .concat(this.extract(content, /const\s+([A-Za-z0-9_]+)\s*=\s*async\s*\(/g)),
      exports: this.extract(content, /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([A-Za-z0-9_]+)/g),
      apiRoutes: this.extractRoutes(content),
      imports: this.extract(content, /import\s+(?:[^'\"]+from\s+)?['\"]([^'\"]+)['\"]/g),
      text: content,
    };
  }

  private isSupported(file: string): boolean {
    return SUPPORTED_EXTENSIONS.has(path.extname(file));
  }

  private extract(content: string, matcher: RegExp): string[] {
    const items: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(content))) {
      if (match[1]) items.push(match[1]);
      if (match[2]) items.push(match[2]);
    }
    return Array.from(new Set(items));
  }

  private extractRoutes(content: string): string[] {
    const routes: string[] = [];
    const routeRegex = /(app|router)\.(get|post|put|delete|patch)\([^,]+/gi;
    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(content))) {
      routes.push(match[0]);
    }
    return routes;
  }
}
