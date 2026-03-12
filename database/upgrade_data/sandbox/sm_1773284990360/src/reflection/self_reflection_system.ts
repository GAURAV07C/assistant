import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DATA_DIR } from '../config.js';

export interface ReflectionInput {
  request: string;
  response: string;
  step_results: Array<{ ok: boolean; detail: string }>;
}

export interface ReflectionOutput {
  quality_score: number;
  detected_issues: string[];
  improvement_suggestions: string[];
}

const REFLECTION_FILE = path.join(EVAL_DATA_DIR, 'self_reflection.jsonl');

export class SelfReflectionSystem {
  reflect(input: ReflectionInput): ReflectionOutput {
    const req = String(input.request || '').toLowerCase();
    const res = String(input.response || '');

    const issues: string[] = [];
    if (res.trim().length < 60) issues.push('response_too_short');
    if (!/[.?!]/.test(res)) issues.push('weak_structure');
    if (/\b(i think|maybe|possibly)\b/i.test(res) && !/\bassumption\b/i.test(res)) issues.push('uncertainty_not_explicit');
    if (input.step_results.some((s) => !s.ok)) issues.push('tool_failures_present');
    if (/\b(refactor|bug|fix|code)\b/.test(req) && !/\b(test|edge|validation)\b/i.test(res)) issues.push('missing_validation_guidance');

    const quality = Math.max(0, Math.min(100, 88 - issues.length * 11));
    const suggestions = issues.map((i) => {
      switch (i) {
        case 'response_too_short': return 'Add concrete steps and expected output.';
        case 'weak_structure': return 'Use clearer structure: problem, options, action.';
        case 'uncertainty_not_explicit': return 'State assumptions and what evidence is missing.';
        case 'tool_failures_present': return 'Add fallback/recovery strategy for failed steps.';
        case 'missing_validation_guidance': return 'Include tests, edge cases, and verification checklist.';
        default: return 'Improve precision and actionable detail.';
      }
    });

    const out: ReflectionOutput = {
      quality_score: quality,
      detected_issues: issues,
      improvement_suggestions: suggestions,
    };

    fs.appendFileSync(REFLECTION_FILE, `${JSON.stringify({ ts: new Date().toISOString(), ...out })}\n`, 'utf8');
    return out;
  }
}
