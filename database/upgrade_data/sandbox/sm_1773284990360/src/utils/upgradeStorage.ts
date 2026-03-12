import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

function ensureDir() {
  fs.mkdirSync(UPGRADE_DATA_DIR, { recursive: true });
}

export function appendUpgradeRecord(filename: string, entry: Record<string, unknown>): void {
  ensureDir();
  const filePath = path.join(UPGRADE_DATA_DIR, filename);
  const list = readUpgradeRecords(filename);
  list.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(list.slice(-200), null, 2), 'utf8');
}

export function readUpgradeRecords(filename: string): Record<string, unknown>[] {
  ensureDir();
  const filePath = path.join(UPGRADE_DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
