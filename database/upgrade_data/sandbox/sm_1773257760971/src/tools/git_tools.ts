import { execFileSync } from 'node:child_process';

export class GitTools {
  stagedDiff(workspaceRoot: string): { ok: boolean; diff?: string; detail: string } {
    try {
      const diff = execFileSync('git', ['diff', '--staged'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      }).trim();
      return { ok: true, diff, detail: diff ? 'Staged diff available' : 'No staged diff' };
    } catch (err) {
      return { ok: false, detail: `git staged diff failed: ${String(err)}` };
    }
  }

  status(workspaceRoot: string): { ok: boolean; output?: string; detail: string } {
    try {
      const output = execFileSync('git', ['status', '--short'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        maxBuffer: 512 * 1024,
      }).trim();
      return { ok: true, output, detail: 'git status collected' };
    } catch (err) {
      return { ok: false, detail: `git status failed: ${String(err)}` };
    }
  }
}
