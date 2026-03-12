export class PatternExtractor {
  extract(files: Record<string, string>): string[] {
    const patterns = new Set<string>();
    for (const content of Object.values(files)) {
      if (/const \w+ = \(.*\) =>/.test(content)) patterns.add('functional pattern');
      if (/class \w+/.test(content) && /extends/.test(content)) patterns.add('class inheritance');
      if (/useEffect\(/.test(content)) patterns.add('hook-driven lifecycle');
      if (/export default /.test(content)) patterns.add('module exports');
      if (/design pattern\b/i.test(content)) patterns.add('explicit design mention');
    }
    return Array.from(patterns).slice(0, 5);
  }
}
