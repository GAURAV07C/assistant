export class CodeAnalyzer {
  analyze(content: string): { patterns: string[]; components: string[] } {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const patterns = lines.filter((l) => /class |function |const |let |import /.test(l)).slice(0, 5);
    const components = lines.filter((l) => /component|widget|screen|layout/.test(l.toLowerCase())).slice(0, 3);
    return { patterns, components: components.length ? components : ['ui_component'] };
  }
}
