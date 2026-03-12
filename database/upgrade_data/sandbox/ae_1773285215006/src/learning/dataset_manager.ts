import fs from 'node:fs';
import path from 'node:path';
import {
  DATASET_DAILY_LOGS_DIR,
  DATASET_HISTORY_DIR,
} from '../config.js';

export interface ConversationRecord {
  timestamp: string;
  session_id: string;
  user_message: string;
  assistant_response: string;
  detected_topic: string;
  coding_context?: string;
  tags: string[];
}

function safeSessionId(sessionId: string): string {
  return String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'unknown';
}

function ymd(iso: string): string {
  return String(iso || new Date().toISOString()).slice(0, 10);
}

export class DatasetManager {
  constructor() {
    fs.mkdirSync(DATASET_DAILY_LOGS_DIR, { recursive: true });
    fs.mkdirSync(DATASET_HISTORY_DIR, { recursive: true });
  }

  store(record: ConversationRecord): void {
    const normalized: ConversationRecord = {
      ...record,
      timestamp: record.timestamp || new Date().toISOString(),
      session_id: safeSessionId(record.session_id),
      user_message: String(record.user_message || '').slice(0, 32_000),
      assistant_response: String(record.assistant_response || '').slice(0, 64_000),
      detected_topic: String(record.detected_topic || 'general').slice(0, 120),
      coding_context: record.coding_context ? String(record.coding_context).slice(0, 10_000) : undefined,
      tags: Array.from(new Set((record.tags || []).map((t) => String(t).trim()).filter(Boolean))).slice(0, 16),
    };

    const line = `${JSON.stringify(normalized)}\n`;
    const dayFile = path.join(DATASET_DAILY_LOGS_DIR, `${ymd(normalized.timestamp)}.jsonl`);
    const historyFile = path.join(DATASET_HISTORY_DIR, `${normalized.session_id}.jsonl`);
    fs.appendFileSync(dayFile, line, 'utf8');
    fs.appendFileSync(historyFile, line, 'utf8');
  }

  readSince(sinceIso?: string, limit = 1000): ConversationRecord[] {
    const since = sinceIso ? Date.parse(sinceIso) : 0;
    const files = fs.readdirSync(DATASET_DAILY_LOGS_DIR).filter((f) => f.endsWith('.jsonl')).sort();
    const out: ConversationRecord[] = [];
    for (const file of files) {
      const raw = fs.readFileSync(path.join(DATASET_DAILY_LOGS_DIR, file), 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const rec = JSON.parse(line) as ConversationRecord;
          const ts = Date.parse(rec.timestamp || '');
          if (since && (!ts || ts <= since)) continue;
          out.push(rec);
          if (out.length >= limit) return out;
        } catch {
          // ignore malformed lines
        }
      }
    }
    return out;
  }
}
