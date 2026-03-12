import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next']);

export interface ProjectEntry {
  path: string;
  relative: string;
  type: 'file' | 'directory';
  depth: number;
}

export interface ProjectScan {
  root: string;
  tree: ProjectEntry[];
  dependencies: string[];
  devDependencies: string[];
  configs: string[];
}

export class RepoScanner {
  scan(root: string, limit = 5000): ProjectScan {
    const tree: ProjectEntry[] = [];
    const queue: Array<{ dir: string; depth: number; relative: string }> = [{ dir: root, depth: 0, relative: '.' }];

    while (queue.length > 0 && tree.length < limit) {
      const current = queue.shift()!;
      const entries = fs.readdirSync(current.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const absolute = path.join(current.dir, entry.name);
        const relative = path.relative(root, absolute) || entry.name;
        if (entry.isDirectory()) {
          tree.push({ path: absolute, relative, type: 'directory', depth: current.depth + 1 });
          queue.push({ dir: absolute, depth: current.depth + 1, relative });
        } else {
          tree.push({ path: absolute, relative, type: 'file', depth: current.depth + 1 });
        }
        if (tree.length >= limit) break;
      }
    }

    const packagePath = path.join(root, '..', 'package.json');
    const { dependencies, devDependencies } = this.readDependencies(packagePath);
    const configs = this.listConfigs(root);

    return {
      root,
      tree,
      dependencies,
      devDependencies,
      configs,
    };
  }

  private readDependencies(packagePath: string): { dependencies: string[]; devDependencies: string[] } {
    if (!fs.existsSync(packagePath)) return { dependencies: [], devDependencies: [] };
    try {
      const raw = fs.readFileSync(packagePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        dependencies: Object.keys(parsed.dependencies || {}).sort(),
        devDependencies: Object.keys(parsed.devDependencies || {}).sort(),
      };
    } catch (err) {
      console.error('Failed to parse package.json', err);
      return { dependencies: [], devDependencies: [] };
    }
  }

  private listConfigs(root: string): string[] {
    const candidates = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.server.json', 'package.json', 'config.ts', '.env'];
    return candidates.filter((name) => fs.existsSync(path.join(root, name)));
  }
}
