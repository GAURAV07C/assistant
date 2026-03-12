import fs from 'node:fs';
import path from 'node:path';

export class FileTools {
  private isWithin(baseDir: string, targetPath: string): boolean {
    const base = path.resolve(baseDir);
    const target = path.resolve(targetPath);
    return target === base || target.startsWith(base + path.sep);
  }

  readFileSafe(workspaceRoot: string, filePath: string): { ok: boolean; content?: string; detail: string } {
    if (!workspaceRoot || !filePath) return { ok: false, detail: 'workspaceRoot and filePath are required' };
    if (!this.isWithin(workspaceRoot, filePath)) return { ok: false, detail: 'File path outside workspace root' };
    if (!fs.existsSync(filePath)) return { ok: false, detail: 'File not found' };
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, content, detail: 'File read successfully' };
  }

  writeFileSafe(workspaceRoot: string, filePath: string, content: string): { ok: boolean; detail: string } {
    if (!workspaceRoot || !filePath) return { ok: false, detail: 'workspaceRoot and filePath are required' };
    if (!this.isWithin(workspaceRoot, filePath)) return { ok: false, detail: 'File path outside workspace root' };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, String(content || ''), 'utf8');
    return { ok: true, detail: 'File written successfully' };
  }

  listFiles(workspaceRoot: string, limit = 80): { ok: boolean; files: string[]; detail: string } {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return { ok: false, files: [], detail: 'workspaceRoot not found' };
    const out: string[] = [];
    const queue = [workspaceRoot];
    while (queue.length > 0 && out.length < limit) {
      const cur = queue.shift()!;
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const abs = path.join(cur, entry.name);
        if (entry.isDirectory()) queue.push(abs);
        else out.push(abs);
        if (out.length >= limit) break;
      }
    }
    return { ok: true, files: out, detail: `Listed ${out.length} files` };
  }
}
