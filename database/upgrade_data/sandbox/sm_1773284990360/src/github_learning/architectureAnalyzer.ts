export class ArchitectureAnalyzer {
  analyze(files: Record<string, string>, repoInfo: { language: string; files: string[] }): string {
    const architectureHints = new Set<string>();
    if (repoInfo.files.some((f) => f.includes('components') || f.includes('pages'))) architectureHints.add('component-driven structure');
    if (Object.keys(files).some((path) => path.includes('api/') || path.includes('routes/'))) architectureHints.add('API-centric layout');
    if (repoInfo.language.toLowerCase() === 'typescript') architectureHints.add('TypeScript-first architecture');
    if (Object.values(files).some((content) => /microservice|worker|queue/.test(content))) architectureHints.add('distributed services');
    if (!architectureHints.size) architectureHints.add('monorepo-style layout');
    return Array.from(architectureHints).join(' | ');
  }
}
