import * as vscode from 'vscode';
import { BackendClient } from '../services/backendClient';
import { StyleProfileStore } from '../services/styleProfile';

const SUPPORTED = ['javascript', 'typescript', 'python', 'javascriptreact', 'typescriptreact'];

function isSupported(languageId: string): boolean {
  return SUPPORTED.includes(languageId);
}

function prefixSuffix(doc: vscode.TextDocument, pos: vscode.Position): { prefix: string; suffix: string } {
  const full = doc.getText();
  const offset = doc.offsetAt(pos);
  return {
    prefix: full.slice(Math.max(0, offset - 2200), offset),
    suffix: full.slice(offset, Math.min(full.length, offset + 1200)),
  };
}

export function registerCompletionProviders(
  context: vscode.ExtensionContext,
  backend: BackendClient,
  styles: StyleProfileStore,
): void {
  const inlineProvider: vscode.InlineCompletionItemProvider = {
    async provideInlineCompletionItems(doc, pos): Promise<vscode.InlineCompletionList> {
      if (!isSupported(doc.languageId)) return new vscode.InlineCompletionList([]);

      const { prefix, suffix } = prefixSuffix(doc, pos);
      if (!prefix.trim()) return new vscode.InlineCompletionList([]);

      try {
        const resp = await backend.completeCode({
          language: doc.languageId,
          prefix,
          suffix,
          style_profile: styles.get(),
        });

        const items = resp.suggestions.slice(0, 1).map((s) => new vscode.InlineCompletionItem(s));
        return new vscode.InlineCompletionList(items);
      } catch {
        return new vscode.InlineCompletionList([]);
      }
    },
  };

  const completionProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(doc, pos): Promise<vscode.CompletionItem[]> {
      if (!isSupported(doc.languageId)) return [];
      const { prefix, suffix } = prefixSuffix(doc, pos);

      try {
        const resp = await backend.completeCode({
          language: doc.languageId,
          prefix,
          suffix,
          style_profile: styles.get(),
        });

        return resp.suggestions.slice(0, 3).map((s, idx) => {
          const item = new vscode.CompletionItem(`Astro ${idx + 1}`, vscode.CompletionItemKind.Snippet);
          item.insertText = s;
          item.detail = 'Astro AI suggestion';
          item.documentation = new vscode.MarkdownString('Context-aware suggestion by Astro.');
          item.sortText = `0${idx}`;
          return item;
        });
      } catch {
        return [];
      }
    },
  };

  const selector: vscode.DocumentSelector = SUPPORTED.map((lang) => ({ language: lang }));

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(selector, inlineProvider),
    vscode.languages.registerCompletionItemProvider(selector, completionProvider, '.', '(', ',', ' '),
  );
}
