import * as vscode from 'vscode';

const SUPPORTED = ['javascript', 'typescript', 'python', 'javascriptreact', 'typescriptreact'];

export function registerQuickHoverProvider(context: vscode.ExtensionContext): void {
  const provider: vscode.HoverProvider = {
    provideHover(document, position) {
      const range = document.getWordRangeAtPosition(position);
      if (!range) return undefined;

      const md = new vscode.MarkdownString(
        [
          '### Astro Quick Actions',
          '',
          '[Explain](command:astro.explainSelection) · [Refactor](command:astro.refactorSelection) · [Fix](command:astro.fixSelection)',
          '',
          '[Bug Detect](command:astro.detectBugs) · [Inline Output](command:astro.outputPreview) · [Ask Astro](command:astro.ask)',
        ].join('\n'),
      );
      md.isTrusted = true;

      return new vscode.Hover(md, range);
    },
  };

  const selector: vscode.DocumentSelector = SUPPORTED.map((lang) => ({ language: lang }));
  context.subscriptions.push(vscode.languages.registerHoverProvider(selector, provider));
}
