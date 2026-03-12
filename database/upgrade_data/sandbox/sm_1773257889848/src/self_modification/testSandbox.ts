import { spawn } from 'node:child_process';

export interface TestResult {
  success: boolean;
  outputs: string[];
  error?: string;
  skipped?: boolean;
}

export class TestSandbox {
  private readonly commands = [
    { cmd: 'npm', args: ['install'] },
    { cmd: 'npm', args: ['run', 'build'] },
    { cmd: 'npm', args: ['run', 'test'] },
  ];

  async runChecks(sandboxPath: string, options?: { runTests?: boolean }): Promise<TestResult> {
    if (!options?.runTests) {
      return {
        success: true,
        outputs: ['Dry-run: test suite skipped (set runTests=true to execute).'],
        skipped: true,
      };
    }

    const outputs: string[] = [];
    for (const entry of this.commands) {
      const prefix = `${entry.cmd} ${entry.args.join(' ')}`;
      try {
        const stdout = await this.executeCommand(entry.cmd, entry.args, sandboxPath);
        outputs.push(`[${prefix}] ${stdout}`);
      } catch (error) {
        return {
          success: false,
          outputs,
          error: String(error),
        };
      }
    }

    return { success: true, outputs };
  }

  private executeCommand(command: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, shell: true });
      let buffer = '';
      child.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        buffer += chunk.toString();
      });
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) {
          resolve(buffer.trim());
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code})\n${buffer}`));
        }
      });
    });
  }
}
