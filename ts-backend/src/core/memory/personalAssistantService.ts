import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../../config.js';

export interface ReminderItem {
  id: string;
  title: string;
  due_at: string;
  notes?: string;
  tags: string[];
  status: 'pending' | 'done';
  created_at: string;
  updated_at: string;
}

interface ReminderStore {
  reminders: ReminderItem[];
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function asIso(input?: string): string {
  const d = input ? new Date(input) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export class PersonalAssistantService {
  private remindersFile = path.join(UPGRADE_DATA_DIR, 'reminders.json');

  private readReminders(): ReminderStore {
    if (!fs.existsSync(this.remindersFile)) return { reminders: [] };
    try {
      return JSON.parse(fs.readFileSync(this.remindersFile, 'utf8')) as ReminderStore;
    } catch {
      return { reminders: [] };
    }
  }

  private writeReminders(store: ReminderStore): void {
    fs.mkdirSync(UPGRADE_DATA_DIR, { recursive: true });
    fs.writeFileSync(this.remindersFile, JSON.stringify(store, null, 2), 'utf8');
  }

  addReminder(input: { title: string; due_at?: string; notes?: string; tags?: string[] }): ReminderItem {
    const store = this.readReminders();
    const now = new Date().toISOString();
    const item: ReminderItem = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: String(input.title || '').trim().slice(0, 240),
      due_at: asIso(input.due_at),
      notes: input.notes ? String(input.notes).slice(0, 2000) : undefined,
      tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20) : [],
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    store.reminders.push(item);
    this.writeReminders(store);
    return item;
  }

  listReminders(opts?: { include_done?: boolean; due_before?: string; due_after?: string }): ReminderItem[] {
    const store = this.readReminders();
    const includeDone = Boolean(opts?.include_done);
    const before = opts?.due_before ? Date.parse(opts.due_before) : Number.POSITIVE_INFINITY;
    const after = opts?.due_after ? Date.parse(opts.due_after) : Number.NEGATIVE_INFINITY;

    return store.reminders
      .filter((r) => includeDone || r.status !== 'done')
      .filter((r) => {
        const due = Date.parse(r.due_at || '');
        return due >= after && due <= before;
      })
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  }

  markReminderDone(id: string): ReminderItem | null {
    const store = this.readReminders();
    const idx = store.reminders.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    store.reminders[idx] = {
      ...store.reminders[idx],
      status: 'done',
      updated_at: new Date().toISOString(),
    };
    this.writeReminders(store);
    return store.reminders[idx];
  }

  generateDailyDigest(input: {
    memory_records: number;
    avg_memory_confidence: number;
    pending_reminders: number;
    top_skills: string[];
    recent_audits: number;
  }): {
    date: string;
    summary: string;
    today_focus: string[];
    created_at: string;
  } {
    const date = todayYmd();
    const createdAt = new Date().toISOString();
    const focus: string[] = [];

    if (input.pending_reminders > 0) focus.push(`Complete ${input.pending_reminders} pending reminder(s).`);
    if (input.avg_memory_confidence < 60) focus.push('Run memory cleanup to improve context quality.');
    if (input.top_skills.length > 0) focus.push(`Practice next level in: ${input.top_skills.slice(0, 3).join(', ')}.`);
    if (input.recent_audits > 0) focus.push('Review recent audit warnings before next major execution.');
    if (focus.length === 0) focus.push('Continue planned execution and keep daily learning streak active.');

    const digest = {
      date,
      summary: `Personal daily digest: memory_records=${input.memory_records}, memory_confidence=${input.avg_memory_confidence}, pending_reminders=${input.pending_reminders}, recent_audits=${input.recent_audits}`,
      today_focus: focus,
      created_at: createdAt,
    };

    fs.mkdirSync(UPGRADE_DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPGRADE_DATA_DIR, `daily_digest_${date}.json`), JSON.stringify(digest, null, 2), 'utf8');
    return digest;
  }

  getLatestDigest(): unknown | null {
    const files = fs.existsSync(UPGRADE_DATA_DIR)
      ? fs.readdirSync(UPGRADE_DATA_DIR).filter((f) => /^daily_digest_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
      : [];
    if (files.length === 0) return null;
    try {
      return JSON.parse(fs.readFileSync(path.join(UPGRADE_DATA_DIR, files[files.length - 1]), 'utf8'));
    } catch {
      return null;
    }
  }
}
