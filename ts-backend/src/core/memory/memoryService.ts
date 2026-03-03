import fs from 'node:fs';
import path from 'node:path';
import { LEARNING_DATA_DIR, MEMORY_DATA_DIR, loadUserContext } from '../../config.js';

export interface MemoryRecord {
  namespace: string;
  key: string;
  value: unknown;
  tags?: string[];
  updated_at: string;
}

interface MemoryStore {
  records: MemoryRecord[];
}

export class MemoryService {
  private memoryFile = path.join(MEMORY_DATA_DIR, 'memory_store.json');
  private profileFile = path.join(MEMORY_DATA_DIR, 'profile_memory.json');

  private sanitizeToken(input: string, fallback: string): string {
    const cleaned = String(input || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120);
    return cleaned || fallback;
  }

  private readStore(): MemoryStore {
    if (!fs.existsSync(this.memoryFile)) return { records: [] };
    try {
      return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8')) as MemoryStore;
    } catch {
      return { records: [] };
    }
  }

  private writeStore(store: MemoryStore): void {
    fs.writeFileSync(this.memoryFile, JSON.stringify(store, null, 2), 'utf8');
  }

  upsert(input: { namespace?: string; key?: string; value: unknown; tags?: string[] }): MemoryRecord {
    const namespace = this.sanitizeToken(input.namespace || 'general', 'general');
    const key = this.sanitizeToken(input.key || 'entry', 'entry');

    const store = this.readStore();
    const now = new Date().toISOString();
    const next: MemoryRecord = {
      namespace,
      key,
      value: input.value,
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 20) : undefined,
      updated_at: now,
    };

    const idx = store.records.findIndex((r) => r.namespace === namespace && r.key === key);
    if (idx >= 0) {
      store.records[idx] = next;
    } else {
      store.records.push(next);
    }

    this.writeStore(store);

    if (namespace === 'profile') {
      fs.writeFileSync(this.profileFile, JSON.stringify(next, null, 2), 'utf8');
    }

    return next;
  }

  profile(): { user_context: string; profile_memory: unknown; records_count: number; learning_files: string[] } {
    const store = this.readStore();
    const profileMemory = fs.existsSync(this.profileFile)
      ? JSON.parse(fs.readFileSync(this.profileFile, 'utf8'))
      : null;

    const learningFiles = fs.existsSync(LEARNING_DATA_DIR)
      ? fs.readdirSync(LEARNING_DATA_DIR).filter((f) => f.endsWith('.txt')).sort()
      : [];

    return {
      user_context: loadUserContext(),
      profile_memory: profileMemory,
      records_count: store.records.length,
      learning_files: learningFiles,
    };
  }
}
