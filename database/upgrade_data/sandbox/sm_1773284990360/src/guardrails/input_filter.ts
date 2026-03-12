export type QueryCategory = 'normal' | 'research' | 'risky';

export interface FilteredInput {
  query: string;
  category: QueryCategory;
  risk_score: number;
  flags: string[];
}

const INJECTION_PATTERNS: Array<{ re: RegExp; flag: string; score: number }> = [
  { re: /\b(ignore|bypass|override)\b.{0,80}\b(instruction|system|policy|safety)\b/i, flag: 'prompt_injection', score: 35 },
  { re: /\b(reveal|show|print|dump)\b.{0,80}\b(prompt|secret|token|api[_-]?key)\b/i, flag: 'secret_exfiltration', score: 40 },
  { re: /```[\s\S]{0,300}\b(system|developer)\b[\s\S]{0,300}```/i, flag: 'role_confusion', score: 22 },
  { re: /\b(ignore|break|disable)\b.{0,80}\b(personal rules?|safety rules?|guardrails?)\b/i, flag: 'personal_rule_bypass', score: 40 },
];

const UNSAFE_PATTERNS: Array<{ re: RegExp; flag: string; score: number }> = [
  { re: /\b(rm\s+-rf|del\s+\/f|format\s+c:|powershell\s+-enc)\b/i, flag: 'destructive_command', score: 55 },
  { re: /\b(sqlmap|xss payload|malware|ransomware|keylogger|exploit)\b/i, flag: 'malicious_intent', score: 45 },
  { re: /\b(steal|exfiltrate|phish|backdoor|disable antivirus)\b/i, flag: 'abuse_intent', score: 50 },
];

const RESEARCH_HINTS = /\b(research|analyze deeply|compare|tradeoff|sources?|citations?|benchmark|latest|state of the art|multi-step)\b/i;

export class InputFilter {
  analyze(rawQuery: string): FilteredInput {
    const query = String(rawQuery || '').trim();
    let risk = 0;
    const flags: string[] = [];

    for (const p of INJECTION_PATTERNS) {
      if (!p.re.test(query)) continue;
      risk += p.score;
      flags.push(p.flag);
    }
    for (const p of UNSAFE_PATTERNS) {
      if (!p.re.test(query)) continue;
      risk += p.score;
      flags.push(p.flag);
    }

    if (query.length > 1800) {
      risk += 8;
      flags.push('oversized_input');
    }

    const cappedRisk = Math.max(0, Math.min(100, risk));
    let category: QueryCategory = 'normal';
    if (cappedRisk >= 45) category = 'risky';
    else if (RESEARCH_HINTS.test(query) || query.length > 300) category = 'research';

    return {
      query,
      category,
      risk_score: cappedRisk,
      flags,
    };
  }

  classifyInputRisk(rawQuery: string): FilteredInput {
    return this.analyze(rawQuery);
  }
}
