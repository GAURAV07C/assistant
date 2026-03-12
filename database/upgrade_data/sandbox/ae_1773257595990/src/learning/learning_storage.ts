import fs from 'node:fs';
import path from 'node:path';
import { LEARNING_DATA_RUNTIME_DIR } from '../config.js';

export function ensureLearningRuntimeDir(): void {
  fs.mkdirSync(LEARNING_DATA_RUNTIME_DIR, { recursive: true });
}

export function appendLearningArtifact(filename: string, entry: Record<string, unknown>): void {
  ensureLearningRuntimeDir();
  const filePath = path.join(LEARNING_DATA_RUNTIME_DIR, filename);
  const list = readLearningArtifacts(filename);
  list.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(list.slice(-200), null, 2), 'utf8');
}

export function readLearningArtifacts(filename: string): Record<string, unknown>[] {
  ensureLearningRuntimeDir();
  const filePath = path.join(LEARNING_DATA_RUNTIME_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
