const UNSAFE_OUTPUT = [
  /\b(step-by-step).{0,80}\b(exploit|hack|bypass|malware)\b/i,
  /\b(command|payload).{0,120}\b(rm\s+-rf|format\s+c:|disable security)\b/i,
  /\b(steal credentials|phishing kit|keylogger)\b/i,
];

function educationalSafeResponse(): string {
  return [
    'I cannot provide unsafe instructions.',
    'I can explain security concepts, risk impact, and safe defensive alternatives instead.',
  ].join(' ');
}

export class OutputFilter {
  sanitize(response: string, opts: { forceEducational?: boolean }): string {
    const raw = String(response || '').trim();
    if (!raw) return educationalSafeResponse();
    if (opts.forceEducational) return educationalSafeResponse();
    for (const rule of UNSAFE_OUTPUT) {
      if (rule.test(raw)) return educationalSafeResponse();
    }
    return raw;
  }

  sanitizeOutput(response: string, opts: { forceEducational?: boolean }): string {
    return this.sanitize(response, opts);
  }
}
