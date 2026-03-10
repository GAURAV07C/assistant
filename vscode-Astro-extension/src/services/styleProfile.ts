import * as vscode from 'vscode';

export interface StyleProfile {
  indent?: 'tab' | number;
  prefersSemicolon?: boolean;
  quote?: 'single' | 'double' | 'mixed';
  updatedAt: string;
}

const KEY = 'astro.styleProfile';

function detectIndent(text: string): 'tab' | number | undefined {
  const lines = text.split(/\r?\n/).slice(0, 120);
  let tabs = 0;
  let spaces2 = 0;
  let spaces4 = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/^\t+/.test(line)) tabs += 1;
    if (/^ {2}\S/.test(line)) spaces2 += 1;
    if (/^ {4}\S/.test(line)) spaces4 += 1;
  }
  if (tabs > spaces2 && tabs > spaces4) return 'tab';
  if (spaces4 >= spaces2 && spaces4 > 0) return 4;
  if (spaces2 > 0) return 2;
  return undefined;
}

function detectSemicolon(text: string): boolean | undefined {
  const codeLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('#'))
    .slice(0, 200);
  if (codeLines.length === 0) return undefined;

  let semi = 0;
  let none = 0;
  for (const line of codeLines) {
    if (/[{(]\s*$/.test(line) || /^\w+\s*:\s*$/.test(line)) continue;
    if (line.endsWith(';')) semi += 1;
    else none += 1;
  }
  if (semi === 0 && none === 0) return undefined;
  return semi >= none;
}

function detectQuotes(text: string): 'single' | 'double' | 'mixed' | undefined {
  const sample = text.slice(0, 6000);
  const single = (sample.match(/'[^'\n]*'/g) || []).length;
  const dbl = (sample.match(/"[^"\n]*"/g) || []).length;
  if (single === 0 && dbl === 0) return undefined;
  if (single > dbl * 1.3) return 'single';
  if (dbl > single * 1.3) return 'double';
  return 'mixed';
}

export class StyleProfileStore {
  constructor(private context: vscode.ExtensionContext) {}

  get(): StyleProfile | undefined {
    return this.context.workspaceState.get<StyleProfile>(KEY);
  }

  async learnFromDocument(doc: vscode.TextDocument): Promise<void> {
    const text = doc.getText();
    const profile: StyleProfile = {
      indent: detectIndent(text),
      prefersSemicolon: detectSemicolon(text),
      quote: detectQuotes(text),
      updatedAt: new Date().toISOString(),
    };
    await this.context.workspaceState.update(KEY, profile);
  }
}
