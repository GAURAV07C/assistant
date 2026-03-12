import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_DATA_DIR } from '../config.js';

export interface SkillMemorySnapshot {
  concepts: string[];
  tools: string[];
  best_practices: string[];
  examples: string[];
  mistakes: string[];
}

const FILES = ['concepts.json', 'tools.json', 'best_practices.json', 'examples.json', 'mistakes.json'] as const;

function uniq(items: string[], limit = 300): string[] {
  const clean = items.map((x) => String(x || '').trim()).filter(Boolean);
  return Array.from(new Set(clean)).slice(0, limit);
}

export class SkillMemory {
  private safeSkillName(name: string): string {
    return String(name || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
  }

  private skillDir(skillName: string): string {
    const safe = this.safeSkillName(skillName);
    const dir = path.join(SKILLS_DATA_DIR, safe);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private filePath(skillName: string, file: typeof FILES[number]): string {
    return path.join(this.skillDir(skillName), file);
  }

  private readArray(skillName: string, file: typeof FILES[number]): string[] {
    const fp = this.filePath(skillName, file);
    if (!fs.existsSync(fp)) return [];
    try {
      const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as unknown;
      return Array.isArray(raw) ? raw.map((x) => String(x || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private writeArray(skillName: string, file: typeof FILES[number], values: string[]): void {
    const fp = this.filePath(skillName, file);
    fs.writeFileSync(fp, JSON.stringify(uniq(values), null, 2), 'utf8');
  }

  ensureSkillMemory(skillName: string): SkillMemorySnapshot {
    for (const file of FILES) {
      const fp = this.filePath(skillName, file);
      if (!fs.existsSync(fp)) fs.writeFileSync(fp, '[]', 'utf8');
    }
    return this.getSkillMemory(skillName);
  }

  getSkillMemory(skillName: string): SkillMemorySnapshot {
    return {
      concepts: this.readArray(skillName, 'concepts.json'),
      tools: this.readArray(skillName, 'tools.json'),
      best_practices: this.readArray(skillName, 'best_practices.json'),
      examples: this.readArray(skillName, 'examples.json'),
      mistakes: this.readArray(skillName, 'mistakes.json'),
    };
  }

  updateSkillMemory(skillName: string, patch: Partial<SkillMemorySnapshot>): SkillMemorySnapshot {
    const current = this.ensureSkillMemory(skillName);
    const next: SkillMemorySnapshot = {
      concepts: uniq([...(current.concepts || []), ...((patch.concepts || []).map(String))]),
      tools: uniq([...(current.tools || []), ...((patch.tools || []).map(String))]),
      best_practices: uniq([...(current.best_practices || []), ...((patch.best_practices || []).map(String))]),
      examples: uniq([...(current.examples || []), ...((patch.examples || []).map(String))]),
      mistakes: uniq([...(current.mistakes || []), ...((patch.mistakes || []).map(String))]),
    };
    this.writeArray(skillName, 'concepts.json', next.concepts);
    this.writeArray(skillName, 'tools.json', next.tools);
    this.writeArray(skillName, 'best_practices.json', next.best_practices);
    this.writeArray(skillName, 'examples.json', next.examples);
    this.writeArray(skillName, 'mistakes.json', next.mistakes);
    return next;
  }
}
