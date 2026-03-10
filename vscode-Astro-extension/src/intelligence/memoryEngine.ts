import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

export interface DeveloperProfile {
  skills: Record<string, number>;
  anti_patterns: Record<string, number>;
  style_preferences: Record<string, string | number | boolean>;
  improvement_score: number;
  last_updated: string;
}

interface PendingSuggestion {
  filePath: string;
  pattern: string;
  ts: number;
}

const PROFILE_FILE = 'developerProfile.json';
const PENDING_KEY = 'astro.pendingSuggestions';

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryEngine {
  private profile: DeveloperProfile = {
    skills: {},
    anti_patterns: {},
    style_preferences: {},
    improvement_score: 0,
    last_updated: nowIso(),
  };

  constructor(private readonly context: vscode.ExtensionContext) {}

  private get profilePath(): string {
    return path.join(this.context.globalStorageUri.fsPath, PROFILE_FILE);
  }

  async initialize(): Promise<void> {
    fs.mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
    if (!fs.existsSync(this.profilePath)) {
      await this.flush();
      return;
    }

    try {
      const raw = fs.readFileSync(this.profilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DeveloperProfile>;
      this.profile = {
        skills: parsed.skills || {},
        anti_patterns: parsed.anti_patterns || {},
        style_preferences: parsed.style_preferences || {},
        improvement_score: Number(parsed.improvement_score || 0),
        last_updated: String(parsed.last_updated || nowIso()),
      };
    } catch {
      await this.flush();
    }
  }

  getSnapshot(): DeveloperProfile {
    return JSON.parse(JSON.stringify(this.profile)) as DeveloperProfile;
  }

  async recordTopics(text: string): Promise<void> {
    const source = String(text || '').toLowerCase();
    const topics = ['dsa', 'async', 'react', 'api', 'database', 'typescript', 'python', 'security', 'performance'];
    let changed = false;
    for (const topic of topics) {
      if (!source.includes(topic)) continue;
      this.profile.skills[topic] = (this.profile.skills[topic] || 0) + 1;
      changed = true;
    }
    if (changed) await this.flush();
  }

  async applyStylePreferences(styleProfile: unknown): Promise<void> {
    if (!styleProfile || typeof styleProfile !== 'object') return;
    const obj = styleProfile as Record<string, unknown>;
    const next: Record<string, string | number | boolean> = {};
    if (typeof obj.indent === 'number' || typeof obj.indent === 'string') next.indent = obj.indent;
    if (typeof obj.prefersSemicolon === 'boolean') next.prefers_semicolon = obj.prefersSemicolon;
    if (typeof obj.quote === 'string') next.quote = obj.quote;
    if (Object.keys(next).length === 0) return;

    this.profile.style_preferences = { ...this.profile.style_preferences, ...next };
    await this.flush();
  }

  async recordAntiPattern(pattern: string): Promise<void> {
    const key = String(pattern || '').trim();
    if (!key) return;
    this.profile.anti_patterns[key] = (this.profile.anti_patterns[key] || 0) + 1;
    await this.flush();
  }

  async markSuggestion(filePath: string, pattern: string): Promise<void> {
    const safePath = String(filePath || '').trim();
    const safePattern = String(pattern || '').trim();
    if (!safePath || !safePattern) return;
    const pending = this.pendingSuggestions();
    pending.push({ filePath: safePath, pattern: safePattern, ts: Date.now() });
    await this.context.workspaceState.update(PENDING_KEY, pending.slice(-80));
  }

  async registerImprovementIfFixed(filePath: string, latestContent: string): Promise<boolean> {
    const safePath = String(filePath || '').trim();
    if (!safePath) return false;
    const pending = this.pendingSuggestions();
    if (pending.length === 0) return false;

    const remaining: PendingSuggestion[] = [];
    let improved = false;
    for (const item of pending) {
      if (item.filePath !== safePath) {
        remaining.push(item);
        continue;
      }
      const stillPresent = this.patternPresent(item.pattern, latestContent);
      if (stillPresent) {
        remaining.push(item);
        continue;
      }
      improved = true;
    }

    if (improved) {
      this.profile.improvement_score += 1;
      await this.flush();
    }
    await this.context.workspaceState.update(PENDING_KEY, remaining.slice(-80));
    return improved;
  }

  private pendingSuggestions(): PendingSuggestion[] {
    const v = this.context.workspaceState.get<PendingSuggestion[]>(PENDING_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  private patternPresent(pattern: string, content: string): boolean {
    const text = String(content || '');
    switch (pattern) {
      case 'nested_loops':
        return /for\s*\([^)]*\)\s*\{[\s\S]{0,500}for\s*\([^)]*\)/i.test(text);
      case 'missing_try_catch':
        return /await\s+[a-zA-Z0-9_$.]+\([^)]*\)\s*;?/i.test(text) && !/try\s*\{[\s\S]{0,2000}catch\s*\(/i.test(text);
      case 'console_log_production':
        return /\bconsole\.log\(/.test(text);
      case 'no_edge_case_handling':
        return !/\b(if\s*\(|switch\s*\(|throw\s+new\s+Error|return\s+null)\b/.test(text);
      default:
        return text.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  private async flush(): Promise<void> {
    this.profile.last_updated = nowIso();
    fs.writeFileSync(this.profilePath, JSON.stringify(this.profile, null, 2), 'utf8');
  }
}
