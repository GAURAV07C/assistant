import fs from 'node:fs';
import path from 'node:path';
import { AUDIT_LOGS_DIR } from '../../config.js';

export interface RouterLogEntry {
  query: string;
  category: 'normal' | 'research' | 'risky';
  risk_score: number;
  routed_to: 'brain_a' | 'brain_b' | 'educational';
  reason: string;
  timestamp: string;
}

export class RouterLogs {
  private filePath(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return path.join(AUDIT_LOGS_DIR, `router-${yyyy}-${mm}-${dd}.jsonl`);
  }

  write(entry: RouterLogEntry): void {
    const line = JSON.stringify(entry);
    fs.appendFileSync(this.filePath(), `${line}\n`, 'utf8');
  }

  logRoutingDecision(entry: RouterLogEntry): void {
    this.write(entry);
  }

  recent(limit = 50): RouterLogEntry[] {
    const files = fs
      .readdirSync(AUDIT_LOGS_DIR)
      .filter((f) => f.startsWith('router-') && f.endsWith('.jsonl'))
      .sort()
      .reverse();

    const out: RouterLogEntry[] = [];
    for (const file of files) {
      const abs = path.join(AUDIT_LOGS_DIR, file);
      const raw = fs.readFileSync(abs, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean).reverse();
      for (const line of lines) {
        try {
          out.push(JSON.parse(line) as RouterLogEntry);
        } catch {
          // ignore malformed lines
        }
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  summary(limit = 300): {
    total: number;
    routed_to: Record<'brain_a' | 'brain_b' | 'educational', number>;
    category: Record<'normal' | 'research' | 'risky', number>;
  } {
    const items = this.recent(limit);
    const routed = { brain_a: 0, brain_b: 0, educational: 0 };
    const category = { normal: 0, research: 0, risky: 0 };

    for (const it of items) {
      routed[it.routed_to] += 1;
      category[it.category] += 1;
    }

    return {
      total: items.length,
      routed_to: routed,
      category,
    };
  }
}
