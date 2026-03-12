import type { ConversationRecord } from './dataset_manager.js';

export interface StructuredInsight {
  timestamp: string;
  session_id: string;
  kind: 'coding_pattern' | 'architecture_idea' | 'bug_fix' | 'problem_solving' | 'preference' | 'technical_explanation' | 'research_concept';
  topic: string;
  summary: string;
  source_tags: string[];
}

const NOISE_PATTERNS = [
  /^\s*(ok|thanks|thx|hmm|yes|no)\s*$/i,
  /^\s*[.?!]+\s*$/,
];

function isNoisy(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  return NOISE_PATTERNS.some((p) => p.test(t));
}

function detectTopic(text: string): string {
  const t = text.toLowerCase();
  if (/\breact|frontend|component|hook\b/.test(t)) return 'react';
  if (/\bapi|endpoint|rest|graphql\b/.test(t)) return 'api';
  if (/\bdb|database|sql|postgres|mysql|redis\b/.test(t)) return 'database';
  if (/\barchitecture|scalab|microservice|system design\b/.test(t)) return 'system_design';
  if (/\bbug|fix|error|exception|trace\b/.test(t)) return 'debugging';
  if (/\bdsa|algorithm|complexity|big-?o\b/.test(t)) return 'dsa';
  return 'general';
}

function dedupe(insights: StructuredInsight[]): StructuredInsight[] {
  const seen = new Set<string>();
  const out: StructuredInsight[] = [];
  for (const it of insights) {
    const key = `${it.kind}|${it.topic}|${it.summary.slice(0, 160)}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export class KnowledgeExtractor {
  extractCodingPatterns(records: ConversationRecord[]): StructuredInsight[] {
    const out: StructuredInsight[] = [];
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      if (!/\b(refactor|pattern|clean code|naming|modular|best practice)\b/i.test(merged)) continue;
      out.push({
        timestamp: rec.timestamp,
        session_id: rec.session_id,
        kind: 'coding_pattern',
        topic: rec.detected_topic || detectTopic(merged),
        summary: String(rec.assistant_response || '').slice(0, 600),
        source_tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : [],
      });
    }
    return out;
  }

  extractArchitectureIdeas(records: ConversationRecord[]): StructuredInsight[] {
    const out: StructuredInsight[] = [];
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      if (!/\b(architecture|system design|tradeoff|scalab|distributed|microservice)\b/i.test(merged)) continue;
      out.push({
        timestamp: rec.timestamp,
        session_id: rec.session_id,
        kind: 'architecture_idea',
        topic: 'system_design',
        summary: String(rec.assistant_response || '').slice(0, 600),
        source_tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : [],
      });
    }
    return out;
  }

  extractUserPreferences(records: ConversationRecord[]): StructuredInsight[] {
    const out: StructuredInsight[] = [];
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      if (!/\b(prefer|style|concise|detailed|indent|semicolon|quotes?)\b/i.test(merged)) continue;
      out.push({
        timestamp: rec.timestamp,
        session_id: rec.session_id,
        kind: 'preference',
        topic: rec.detected_topic || 'general',
        summary: String(rec.user_message || '').slice(0, 600),
        source_tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : [],
      });
    }
    return out;
  }

  extractProblemSolutions(records: ConversationRecord[]): StructuredInsight[] {
    const out: StructuredInsight[] = [];
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      if (!/\b(fix|resolved|solution|root cause|debug|issue)\b/i.test(merged)) continue;
      out.push({
        timestamp: rec.timestamp,
        session_id: rec.session_id,
        kind: /\b(root cause|fix|resolved)\b/i.test(merged) ? 'bug_fix' : 'problem_solving',
        topic: rec.detected_topic || detectTopic(merged),
        summary: String(rec.assistant_response || '').slice(0, 600),
        source_tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : [],
      });
    }
    return out;
  }

  extract(records: ConversationRecord[]): StructuredInsight[] {
    const filtered = records.filter((rec) => !isNoisy(rec.user_message) && !isNoisy(rec.assistant_response));

    const generic: StructuredInsight[] = [];
    for (const rec of filtered) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      const topic = rec.detected_topic || detectTopic(merged);
      const tags = Array.isArray(rec.tags) ? rec.tags : [];

      let kind: StructuredInsight['kind'] = 'technical_explanation';
      if (/\bresearch|source|documentation\b/i.test(merged)) kind = 'research_concept';

      generic.push({
        timestamp: rec.timestamp,
        session_id: rec.session_id,
        kind,
        topic,
        summary: String(rec.assistant_response || '').slice(0, 600),
        source_tags: tags.slice(0, 12),
      });
    }

    return dedupe([
      ...this.extractCodingPatterns(filtered),
      ...this.extractArchitectureIdeas(filtered),
      ...this.extractUserPreferences(filtered),
      ...this.extractProblemSolutions(filtered),
      ...generic,
    ]);
  }
}
