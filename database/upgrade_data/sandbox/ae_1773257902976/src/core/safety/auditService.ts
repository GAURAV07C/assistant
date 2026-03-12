import fs from 'node:fs';
import path from 'node:path';
import { AUDIT_LOGS_DIR } from '../../config.js';

export interface AuditLogEntry {
  ts: string;
  route: string;
  action: string;
  status: 'allowed' | 'blocked' | 'error';
  session_id?: string;
  details?: Record<string, unknown>;
}

export class AuditService {
  private filePathForDay(date = new Date()): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return path.join(AUDIT_LOGS_DIR, `audit-${yyyy}-${mm}-${dd}.jsonl`);
  }

  log(entry: AuditLogEntry): void {
    const line = JSON.stringify(entry);
    fs.appendFileSync(this.filePathForDay(), `${line}\n`, 'utf8');
  }

  recent(limit = 50): AuditLogEntry[] {
    const files = fs
      .readdirSync(AUDIT_LOGS_DIR)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
      .sort()
      .reverse();

    const out: AuditLogEntry[] = [];
    for (const file of files) {
      const raw = fs.readFileSync(path.join(AUDIT_LOGS_DIR, file), 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean).reverse();
      for (const line of lines) {
        try {
          out.push(JSON.parse(line) as AuditLogEntry);
        } catch {
          // skip malformed line
        }
        if (out.length >= limit) return out;
      }
    }

    return out;
  }
}
