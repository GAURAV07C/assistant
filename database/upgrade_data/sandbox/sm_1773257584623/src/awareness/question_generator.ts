export class QuestionGenerator {
  generate(gaps: string[]): string[] {
    const out: string[] = [];
    for (const gap of gaps.slice(0, 6)) {
      out.push(`What are the core principles of ${gap} in this project context?`);
      out.push(`How can ${gap} improve reliability, quality, or speed in Jarvis?`);
    }
    return out.slice(0, 8);
  }
}
