import fs from 'node:fs';
import path from 'node:path';
import { LEARNING_DATA_RUNTIME_DIR } from '../config.js';

const STATS_FILE = path.join(LEARNING_DATA_RUNTIME_DIR, 'learning_stats.json');

type LearningType = 'youtube' | 'web' | 'multimodal' | 'github';

interface LearningStatsRecord {
  total: number;
  latest: string | null;
  entries: Array<{ id: string; source: string; timestamp: string }>;
}

interface LearningStatsPayload {
  youtube: LearningStatsRecord;
  web: LearningStatsRecord;
  multimodal: LearningStatsRecord;
  github: LearningStatsRecord;
}

function ensureStatsFile(): LearningStatsPayload {
  fs.mkdirSync(LEARNING_DATA_RUNTIME_DIR, { recursive: true });
  if (!fs.existsSync(STATS_FILE)) {
    const initial: LearningStatsPayload = {
      youtube: { total: 0, latest: null, entries: [] },
      web: { total: 0, latest: null, entries: [] },
      multimodal: { total: 0, latest: null, entries: [] },
      github: { total: 0, latest: null, entries: [] },
    };
    fs.writeFileSync(STATS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) as LearningStatsPayload;
    return parsed;
  } catch {
    const fallback: LearningStatsPayload = {
      youtube: { total: 0, latest: null, entries: [] },
      web: { total: 0, latest: null, entries: [] },
      multimodal: { total: 0, latest: null, entries: [] },
      github: { total: 0, latest: null, entries: [] },
    };
    fs.writeFileSync(STATS_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function persistStats(payload: LearningStatsPayload): void {
  fs.writeFileSync(STATS_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

export class LearningStats {
  record(type: LearningType, source: string, metaId: string): void {
    const payload = ensureStatsFile();
    const record = payload[type];
    const ts = new Date().toISOString();
    record.total += 1;
    record.latest = ts;
    record.entries.unshift({ id: metaId, source, timestamp: ts });
    if (record.entries.length > 20) record.entries.pop();
    persistStats(payload);
  }

  read(): LearningStatsPayload {
    return ensureStatsFile();
  }
}
