import { execFileSync } from 'node:child_process';

const ALLOWED_COMMANDS = new Set(['npm', 'node', 'npx', 'pnpm', 'yarn', 'git', 'ls', 'pwd']);

export class TerminalTools {
  runSafe(workspaceRoot: string, command: string, args: string[] = []): { ok: boolean; output?: string; detail: string } {
    const cmd = String(command || '').trim();
    if (!ALLOWED_COMMANDS.has(cmd)) {
      return { ok: false, detail: `Command not allowed: ${cmd}` };
    }

    try {
      const output = execFileSync(cmd, args, {
        cwd: workspaceRoot,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      });
      return { ok: true, output: String(output).slice(0, 12000), detail: 'Command executed successfully' };
    } catch (err) {
      return { ok: false, detail: `Command failed: ${String(err)}` };
    }
  }
}
