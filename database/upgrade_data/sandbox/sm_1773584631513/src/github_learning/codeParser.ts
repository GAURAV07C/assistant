export class CodeParser {
  extractModules(files: Record<string, string>): string[] {
    const modules = new Set<string>();
    for (const [path, content] of Object.entries(files)) {
      if (!content) continue;
      const match = path.split('/').slice(-1)[0];
      if (match.endsWith('.ts') || match.endsWith('.js') || match.endsWith('.tsx')) {
        modules.add(match.replace(/\.(tsx|ts|js)$/, ''));
      }
    }
    return Array.from(modules).slice(0, 6);
  }

  detectApi(files: Record<string, string>): string[] {
    const apis: string[] = [];
    for (const content of Object.values(files)) {
      if (/\bgetServerSideProps\b/.test(content)) apis.push('SSR API');
      if (/\bapi\/\w+/.test(content)) apis.push('REST API');
      if (/\bapi\s*:\s*{/g.test(content)) apis.push('API object');
    }
    return Array.from(new Set(apis));
  }
}
