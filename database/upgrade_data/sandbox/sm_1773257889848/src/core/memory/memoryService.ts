import fs from 'node:fs';
import path from 'node:path';
import {
  ANTI_PATTERNS_DIR,
  CODING_STYLE_DIR,
  DOMAIN_INTEREST_DIR,
  LEARNING_DATA_DIR,
  MEMORY_DATA_DIR,
  PROFILES_DIR,
  SKILL_PROGRESS_DIR,
  loadUserContext,
} from '../../config.js';

export interface MemoryRecord {
  namespace: string;
  key: string;
  value: unknown;
  tags?: string[];
  updated_at: string;
}

export interface MemoryConfidenceRecord extends MemoryRecord {
  confidence: number;
  age_days: number;
  stale: boolean;
}

interface MemoryStore {
  records: MemoryRecord[];
}

interface SkillProgress {
  dsa_topics: Record<string, number>;
  system_design_topics: Record<string, number>;
  bug_frequency: number;
  difficulty_trend: 'stable' | 'rising' | 'falling';
  updated_at: string;
}

interface CodingStyleProfile {
  indentation: 'tabs' | '2_spaces' | '4_spaces' | 'mixed' | 'unknown';
  naming_style: 'camelCase' | 'snake_case' | 'PascalCase' | 'mixed' | 'unknown';
  semicolon_usage: 'always' | 'rare' | 'mixed' | 'unknown';
  architecture_tendencies: string[];
  updated_at: string;
}

interface AntiPatternRecord {
  pattern: string;
  count: number;
  last_seen_at: string;
  examples: string[];
}

interface PersonalFact {
  key: string;
  value: string;
  confidence: number;
  source: string;
}

export class MemoryService {
  private memoryFile = path.join(MEMORY_DATA_DIR, 'memory_store.json');
  private profileFile = path.join(MEMORY_DATA_DIR, 'profile_memory.json');

  private structuredProfileFile = path.join(PROFILES_DIR, 'primary_profile.json');
  private codingStyleFile = path.join(CODING_STYLE_DIR, 'coding_style.json');
  private skillProgressFile = path.join(SKILL_PROGRESS_DIR, 'skill_progress.json');
  private antiPatternsFile = path.join(ANTI_PATTERNS_DIR, 'anti_patterns.json');
  private domainInterestFile = path.join(DOMAIN_INTEREST_DIR, 'domain_interest.json');

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

  private readJsonFile<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  private writeJsonFile(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  }

  private tokenize(text: string): string[] {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private overlapScore(a: string, b: string): number {
    const sa = new Set(this.tokenize(a));
    const sb = new Set(this.tokenize(b));
    if (!sa.size || !sb.size) return 0;
    let overlap = 0;
    for (const t of sa.values()) if (sb.has(t)) overlap += 1;
    return overlap;
  }

  private extractPersonalFacts(text: string): PersonalFact[] {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const out: PersonalFact[] = [];

    const name = raw.match(/\b(?:my name is|i am|i'm)\s+([a-z][a-z\s]{1,40})/i);
    if (name?.[1]) out.push({ key: 'name', value: name[1].trim(), confidence: 85, source: 'message_pattern' });

    const from = raw.match(/\b(?:i am from|i'm from|i live in|my city is)\s+([a-z][a-z\s,]{1,60})/i);
    if (from?.[1]) out.push({ key: 'location', value: from[1].trim(), confidence: 80, source: 'message_pattern' });

    const prefers = raw.match(/\b(?:i prefer|please use|use)\s+(.{3,80})$/i);
    if (prefers?.[1]) out.push({ key: 'preference', value: prefers[1].trim(), confidence: 72, source: 'message_pattern' });

    const goal = raw.match(/\b(?:my goal is|i want to|i wanna|i need to)\s+(.{4,120})$/i);
    if (goal?.[1]) out.push({ key: 'goal', value: goal[1].trim(), confidence: 78, source: 'message_pattern' });

    const role = raw.match(/\b(?:i am a|i'm a)\s+([a-z][a-z\s]{2,50})/i);
    if (role?.[1]) out.push({ key: 'role', value: role[1].trim(), confidence: 70, source: 'message_pattern' });

    return out.slice(0, 8);
  }

  capturePersonalFactsFromMessage(text: string): { stored: number; facts: Array<{ key: string; value: string }> } {
    const facts = this.extractPersonalFacts(text);
    for (const fact of facts) {
      this.upsert({
        namespace: 'personal_facts',
        key: fact.key,
        value: {
          value: fact.value,
          confidence: fact.confidence,
          source: fact.source,
          captured_at: new Date().toISOString(),
        },
        tags: ['personal', 'fact', fact.key],
      });
    }
    return {
      stored: facts.length,
      facts: facts.map((f) => ({ key: f.key, value: f.value })),
    };
  }

  buildRecallContext(query: string, limit = 8): {
    facts: string[];
    sources: Array<{ namespace: string; key: string; score: number }>;
  } {
    const q = String(query || '');
    const store = this.readStore();
    const scored = store.records
      .map((r) => {
        let text = '';
        if (typeof r.value === 'string') text = r.value;
        else {
          try {
            text = JSON.stringify(r.value);
          } catch {
            text = String(r.value || '');
          }
        }
        const base = this.overlapScore(q, `${r.namespace} ${r.key} ${text}`);
        const priority = /personal_facts|profile|preferences|goal/i.test(`${r.namespace}/${r.key}`) ? 4 : 0;
        return { r, text, score: base + priority };
      })
      .filter((it) => it.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(30, limit * 2)));

    const facts: string[] = [];
    const sources: Array<{ namespace: string; key: string; score: number }> = [];
    for (const item of scored) {
      const raw = item.r.value as any;
      const val = typeof raw === 'string' ? raw : (raw?.value ? String(raw.value) : item.text);
      facts.push(`${item.r.key}: ${val}`.slice(0, 220));
      sources.push({ namespace: item.r.namespace, key: item.r.key, score: item.score });
      if (facts.length >= limit) break;
    }

    return { facts, sources };
  }

  previewPersonalFacts(text: string): Array<{ key: string; value: string }> {
    return this.extractPersonalFacts(text).map((f) => ({ key: f.key, value: f.value }));
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

    if (namespace === 'profile' || namespace === 'profiles') {
      this.writeJsonFile(this.profileFile, next);
      this.writeJsonFile(this.structuredProfileFile, {
        updated_at: now,
        key,
        value: input.value,
        tags: input.tags || [],
      });
    }

    return next;
  }

  trackCodingStyle(sample: { text?: string; architectureHint?: string }): CodingStyleProfile {
    const text = String(sample.text || '');
    const now = new Date().toISOString();

    const lineMatches = text.split(/\r?\n/).map((line) => (line.match(/^(\s+)/)?.[1] || ''));
    const tabCount = lineMatches.filter((s) => s.includes('\t')).length;
    const twoSpaceCount = lineMatches.filter((s) => s.startsWith('  ') && !s.startsWith('    ')).length;
    const fourSpaceCount = lineMatches.filter((s) => s.startsWith('    ')).length;

    let indentation: CodingStyleProfile['indentation'] = 'unknown';
    if (tabCount > 0 && twoSpaceCount === 0 && fourSpaceCount === 0) indentation = 'tabs';
    else if (twoSpaceCount > fourSpaceCount && twoSpaceCount > 0) indentation = '2_spaces';
    else if (fourSpaceCount > twoSpaceCount && fourSpaceCount > 0) indentation = '4_spaces';
    else if (tabCount + twoSpaceCount + fourSpaceCount > 0) indentation = 'mixed';

    const semicolons = (text.match(/;/g) || []).length;
    const statementEndings = (text.match(/[\n}]/g) || []).length || 1;
    const semicolonRatio = semicolons / statementEndings;
    const semicolonUsage: CodingStyleProfile['semicolon_usage'] = semicolonRatio > 0.65
      ? 'always'
      : semicolonRatio < 0.2
        ? 'rare'
        : 'mixed';

    const camel = (text.match(/\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g) || []).length;
    const snake = (text.match(/\b[a-z]+_[a-z0-9_]+\b/g) || []).length;
    const pascal = (text.match(/\b[A-Z][a-zA-Z0-9]+\b/g) || []).length;

    let naming: CodingStyleProfile['naming_style'] = 'unknown';
    const max = Math.max(camel, snake, pascal);
    if (max > 0) {
      if (max === camel && camel > snake && camel > pascal) naming = 'camelCase';
      else if (max === snake && snake > camel && snake > pascal) naming = 'snake_case';
      else if (max === pascal && pascal > camel && pascal > snake) naming = 'PascalCase';
      else naming = 'mixed';
    }

    const existing = this.readJsonFile<CodingStyleProfile>(this.codingStyleFile, {
      indentation: 'unknown',
      naming_style: 'unknown',
      semicolon_usage: 'unknown',
      architecture_tendencies: [],
      updated_at: now,
    });

    const tendencies = new Set(existing.architecture_tendencies || []);
    if (sample.architectureHint) tendencies.add(sample.architectureHint);
    if (/controller|service|repository/i.test(text)) tendencies.add('layered_architecture');
    if (/event|queue|worker/i.test(text)) tendencies.add('async_event_driven');

    const profile: CodingStyleProfile = {
      indentation: indentation === 'unknown' ? existing.indentation : indentation,
      naming_style: naming === 'unknown' ? existing.naming_style : naming,
      semicolon_usage: semicolonUsage,
      architecture_tendencies: Array.from(tendencies).slice(0, 20),
      updated_at: now,
    };

    this.writeJsonFile(this.codingStyleFile, profile);
    return profile;
  }

  updateSkillProgressFromText(text: string): { topics_updated: number; difficulty_trend: SkillProgress['difficulty_trend']; bug_frequency: number } {
    const now = new Date().toISOString();
    const payload = this.readJsonFile<SkillProgress>(this.skillProgressFile, {
      dsa_topics: {},
      system_design_topics: {},
      bug_frequency: 0,
      difficulty_trend: 'stable',
      updated_at: now,
    });

    const lower = String(text || '').toLowerCase();

    const dsaKeywords = ['array', 'string', 'tree', 'graph', 'dp', 'dynamic programming', 'binary search', 'heap'];
    const sdKeywords = ['scalability', 'sharding', 'load balancer', 'cache', 'queue', 'microservice', 'consistency'];

    let touched = 0;
    for (const k of dsaKeywords) {
      if (lower.includes(k)) {
        payload.dsa_topics[k] = (payload.dsa_topics[k] || 0) + 1;
        touched += 1;
      }
    }

    for (const k of sdKeywords) {
      if (lower.includes(k)) {
        payload.system_design_topics[k] = (payload.system_design_topics[k] || 0) + 1;
        touched += 1;
      }
    }

    if (/bug|error|fix|exception|issue/.test(lower)) payload.bug_frequency += 1;

    if (/(hard|complex|advanced|distributed|optimi[sz]ation)/.test(lower)) payload.difficulty_trend = 'rising';
    else if (/(easy|basic|simple)/.test(lower)) payload.difficulty_trend = 'falling';
    else payload.difficulty_trend = 'stable';

    payload.updated_at = now;
    this.writeJsonFile(this.skillProgressFile, payload);

    return {
      topics_updated: touched,
      difficulty_trend: payload.difficulty_trend,
      bug_frequency: payload.bug_frequency,
    };
  }

  recordAntiPatternFromText(text: string): { pattern: string; count: number; warning: string } {
    const lower = String(text || '').toLowerCase();
    const now = new Date().toISOString();

    let pattern = 'generic_repeat_issue';
    if (/nested loop|o\(n\^2\)|quadratic/.test(lower)) pattern = 'performance_quadratic_loop';
    else if (/global state|shared mutable|side effect/.test(lower)) pattern = 'shared_state_coupling';
    else if (/callback hell|deep nesting/.test(lower)) pattern = 'deep_nesting';
    else if (/sql injection|xss|csrf|unsafe/.test(lower)) pattern = 'security_risk_pattern';

    const records = this.readJsonFile<AntiPatternRecord[]>(this.antiPatternsFile, []);
    const idx = records.findIndex((r) => r.pattern === pattern);

    if (idx >= 0) {
      records[idx].count += 1;
      records[idx].last_seen_at = now;
      records[idx].examples = [String(text || '').slice(0, 280), ...(records[idx].examples || [])].slice(0, 5);
    } else {
      records.push({
        pattern,
        count: 1,
        last_seen_at: now,
        examples: [String(text || '').slice(0, 280)],
      });
    }

    this.writeJsonFile(this.antiPatternsFile, records);

    const updated = records.find((r) => r.pattern === pattern)!;
    const warning = updated.count >= 3
      ? `Pattern '${pattern}' repeated ${updated.count} times. Proactive warning triggered.`
      : `Pattern '${pattern}' tracked.`;

    return { pattern, count: updated.count, warning };
  }

  updateDomainInterest(input: { domain: string; weight?: number }): { domain: string; score: number } {
    const key = this.sanitizeToken(input.domain, 'general');
    const data = this.readJsonFile<Record<string, number>>(this.domainInterestFile, {});
    const next = (data[key] || 0) + (input.weight || 1);
    data[key] = next;
    this.writeJsonFile(this.domainInterestFile, data);
    return { domain: key, score: next };
  }

  profile(): {
    user_context: string;
    profile_memory: unknown;
    records_count: number;
    learning_files: string[];
    structured_memory: {
      profile: unknown;
      coding_style: unknown;
      skill_progress: unknown;
      anti_patterns: unknown;
      domain_interest: unknown;
    };
  } {
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
      structured_memory: {
        profile: this.readJsonFile(this.structuredProfileFile, null),
        coding_style: this.readJsonFile(this.codingStyleFile, null),
        skill_progress: this.readJsonFile(this.skillProgressFile, null),
        anti_patterns: this.readJsonFile(this.antiPatternsFile, []),
        domain_interest: this.readJsonFile(this.domainInterestFile, {}),
      },
    };
  }

  memoryConfidence(limit = 200): { total: number; avg_confidence: number; records: MemoryConfidenceRecord[] } {
    const store = this.readStore();
    const now = Date.now();
    const records = store.records
      .slice(-Math.max(1, Math.min(2000, limit)))
      .map((r) => {
        const ts = Date.parse(r.updated_at || '');
        const ageDays = Number.isFinite(ts) ? Math.max(0, Math.floor((now - ts) / (24 * 60 * 60 * 1000))) : 365;
        const agePenalty = Math.min(60, ageDays * 2);
        const tagsBonus = Array.isArray(r.tags) && r.tags.length > 0 ? 6 : -4;
        const nsBonus = /profile|learning|skills|agent/i.test(r.namespace) ? 6 : 0;
        const valuePenalty = r.value == null ? 15 : 0;
        const confidence = Math.max(0, Math.min(100, 100 - agePenalty + tagsBonus + nsBonus - valuePenalty));
        return {
          ...r,
          confidence,
          age_days: ageDays,
          stale: ageDays > 30 || confidence < 35,
        } as MemoryConfidenceRecord;
      });

    const avg = records.length > 0
      ? Math.round(records.reduce((acc, r) => acc + r.confidence, 0) / records.length)
      : 0;
    return { total: records.length, avg_confidence: avg, records };
  }

  cleanupStaleMemory(opts?: { min_age_days?: number; max_delete?: number; confidence_threshold?: number }): {
    before: number;
    deleted: number;
    after: number;
    sample_deleted: string[];
  } {
    const minAge = Math.max(1, Math.min(3650, Number(opts?.min_age_days || 30)));
    const maxDelete = Math.max(1, Math.min(5000, Number(opts?.max_delete || 500)));
    const threshold = Math.max(0, Math.min(100, Number(opts?.confidence_threshold || 35)));
    const store = this.readStore();
    const now = Date.now();

    const survivors: MemoryRecord[] = [];
    const deleted: MemoryRecord[] = [];

    for (const rec of store.records) {
      const ts = Date.parse(rec.updated_at || '');
      const ageDays = Number.isFinite(ts) ? Math.max(0, Math.floor((now - ts) / (24 * 60 * 60 * 1000))) : 365;
      const agePenalty = Math.min(60, ageDays * 2);
      const tagsBonus = Array.isArray(rec.tags) && rec.tags.length > 0 ? 6 : -4;
      const nsBonus = /profile|learning|skills|agent/i.test(rec.namespace) ? 6 : 0;
      const valuePenalty = rec.value == null ? 15 : 0;
      const confidence = Math.max(0, Math.min(100, 100 - agePenalty + tagsBonus + nsBonus - valuePenalty));

      const removable = ageDays >= minAge && confidence < threshold && deleted.length < maxDelete;
      if (removable) deleted.push(rec);
      else survivors.push(rec);
    }

    this.writeStore({ records: survivors });
    return {
      before: store.records.length,
      deleted: deleted.length,
      after: survivors.length,
      sample_deleted: deleted.slice(0, 10).map((r) => `${r.namespace}/${r.key}`),
    };
  }
}
