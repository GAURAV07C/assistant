import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const SANDBOX_ROOT = path.join(UPGRADE_DATA_DIR, 'sandbox');
const PROJECT_ROOT = process.cwd();
const EXCLUDE_PATTERNS = /node_modules|\.git|sandbox|\.cache/;

export class RepoCloner {
  async cloneSandbox(workId: string): Promise<string> {
    const dest = path.join(SANDBOX_ROOT, workId);
    await fs.promises.rm(dest, { recursive: true, force: true });
    await fs.promises.mkdir(dest, { recursive: true });
    await fs.promises.cp(PROJECT_ROOT, dest, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(PROJECT_ROOT, src);
        if (!rel) return true;
        if (EXCLUDE_PATTERNS.test(rel)) return false;
        return true;
      },
    });
    return dest;
  }

  async cleanup(workId: string): Promise<void> {
    const dest = path.join(SANDBOX_ROOT, workId);
    await fs.promises.rm(dest, { recursive: true, force: true });
  }
}
