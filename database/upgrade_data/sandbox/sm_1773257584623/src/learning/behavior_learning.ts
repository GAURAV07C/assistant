import fs from 'node:fs';
import { BEHAVIOR_PROFILE_FILE } from '../config.js';
import type { ConversationRecord } from './dataset_manager.js';

interface BehaviorProfile {
  coding_style: {
    indentation: 'tabs' | '2_spaces' | '4_spaces' | 'mixed' | 'unknown';
    semicolons: 'yes' | 'no' | 'mixed' | 'unknown';
    quote_style: 'single' | 'double' | 'mixed' | 'unknown';
  };
  framework_usage: Record<string, number>;
  architecture_patterns: Record<string, number>;
  tool_usage_patterns: Record<string, number>;
  explanation_style: 'short' | 'detailed' | 'mixed';
  updated_at: string;
}

function detectIndent(text: string): BehaviorProfile['coding_style']['indentation'] {
  const lines = text.split(/\r?\n/).slice(0, 200);
  let tabs = 0;
  let two = 0;
  let four = 0;
  for (const line of lines) {
    if (/^\t+/.test(line)) tabs += 1;
    if (/^ {2}\S/.test(line)) two += 1;
    if (/^ {4}\S/.test(line)) four += 1;
  }
  if (tabs > two && tabs > four) return 'tabs';
  if (four > two && four > 0) return '4_spaces';
  if (two > 0) return '2_spaces';
  if (tabs + two + four > 0) return 'mixed';
  return 'unknown';
}

export class BehaviorLearning {
  private read(): BehaviorProfile {
    if (!fs.existsSync(BEHAVIOR_PROFILE_FILE)) {
      return {
        coding_style: { indentation: 'unknown', semicolons: 'unknown', quote_style: 'unknown' },
        framework_usage: {},
        architecture_patterns: {},
        tool_usage_patterns: {},
        explanation_style: 'mixed',
        updated_at: new Date().toISOString(),
      };
    }
    try {
      return JSON.parse(fs.readFileSync(BEHAVIOR_PROFILE_FILE, 'utf8')) as BehaviorProfile;
    } catch {
      return {
        coding_style: { indentation: 'unknown', semicolons: 'unknown', quote_style: 'unknown' },
        framework_usage: {},
        architecture_patterns: {},
        tool_usage_patterns: {},
        explanation_style: 'mixed',
        updated_at: new Date().toISOString(),
      };
    }
  }

  private write(profile: BehaviorProfile): void {
    profile.updated_at = new Date().toISOString();
    fs.writeFileSync(BEHAVIOR_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf8');
  }

  learnCodingStyle(records: ConversationRecord[], profile: BehaviorProfile): void {
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      const indent = detectIndent(merged);
      if (indent !== 'unknown') profile.coding_style.indentation = indent;

      const semis = (merged.match(/;/g) || []).length;
      const lines = merged.split(/\r?\n/).filter((l) => l.trim()).length || 1;
      const ratio = semis / lines;
      profile.coding_style.semicolons = ratio > 0.5 ? 'yes' : ratio < 0.1 ? 'no' : 'mixed';

      const single = (merged.match(/'[^'\n]*'/g) || []).length;
      const dbl = (merged.match(/"[^"\n]*"/g) || []).length;
      profile.coding_style.quote_style = single > dbl * 1.3 ? 'single' : dbl > single * 1.3 ? 'double' : 'mixed';
    }
  }

  learnArchitecturePreference(records: ConversationRecord[], profile: BehaviorProfile): void {
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      if (/\breact\b/i.test(merged)) profile.framework_usage.react = (profile.framework_usage.react || 0) + 1;
      if (/\bnode\b|\bexpress\b/i.test(merged)) profile.framework_usage.node = (profile.framework_usage.node || 0) + 1;
      if (/\bnext\.?js\b/i.test(merged)) profile.framework_usage.nextjs = (profile.framework_usage.nextjs || 0) + 1;
      if (/\bmicroservice|layered|repository\b/i.test(merged)) {
        profile.architecture_patterns.layered = (profile.architecture_patterns.layered || 0) + 1;
      }
      if (/\bevent|queue|worker\b/i.test(merged)) {
        profile.architecture_patterns.event_driven = (profile.architecture_patterns.event_driven || 0) + 1;
      }
    }
  }

  learnToolUsagePattern(records: ConversationRecord[], profile: BehaviorProfile): void {
    for (const rec of records) {
      const merged = `${rec.user_message || ''}\n${rec.assistant_response || ''}`;
      if (/\bgit\b|commit|branch|rebase/i.test(merged)) profile.tool_usage_patterns.git = (profile.tool_usage_patterns.git || 0) + 1;
      if (/\btest\b|jest|pytest|vitest/i.test(merged)) profile.tool_usage_patterns.testing = (profile.tool_usage_patterns.testing || 0) + 1;
      if (/\blint\b|eslint|prettier/i.test(merged)) profile.tool_usage_patterns.linting = (profile.tool_usage_patterns.linting || 0) + 1;

      const asksDetailed = /\bdeep|detail|explain in detail|step by step\b/i.test(rec.user_message || '');
      const asksShort = /\bshort|brief|concise\b/i.test(rec.user_message || '');
      if (asksDetailed && !asksShort) profile.explanation_style = 'detailed';
      else if (asksShort && !asksDetailed) profile.explanation_style = 'short';
      else profile.explanation_style = 'mixed';
    }
  }

  update(records: ConversationRecord[]): void {
    if (records.length === 0) return;
    const profile = this.read();
    this.learnCodingStyle(records, profile);
    this.learnArchitecturePreference(records, profile);
    this.learnToolUsagePattern(records, profile);
    this.write(profile);
  }
}
