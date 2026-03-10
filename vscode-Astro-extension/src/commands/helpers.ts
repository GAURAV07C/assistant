import * as vscode from 'vscode';
import { execFileSync } from 'node:child_process';
import type { CodeContextPayload } from '../services/backendClient';

const RECENT_EDITS = new Map<string, string[]>();

function stagedDiffForFile(workspaceRoot: string, filePath: string): string | undefined {
  if (!workspaceRoot || !filePath) return undefined;
  try {
    const diff = execFileSync('git', ['diff', '--staged', '--', filePath], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      maxBuffer: 512 * 1024,
      timeout: 1200,
    }).trim();
    return diff || undefined;
  } catch {
    return undefined;
  }
}

export function recordRecentEdit(doc: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]): void {
  const key = doc.uri.toString();
  const prev = RECENT_EDITS.get(key) || [];
  const snippets = changes
    .map((c) => String(c.text || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4);
  if (snippets.length === 0) return;
  RECENT_EDITS.set(key, [...prev, ...snippets].slice(-12));
}

export function getCodeContext(sessionId?: string): CodeContextPayload | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const doc = editor.document;
  const selection = editor.selection.isEmpty ? '' : doc.getText(editor.selection);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  const recentEdits = RECENT_EDITS.get(doc.uri.toString()) || [];
  const gitDiff = stagedDiffForFile(workspaceRoot, doc.uri.fsPath);

  return {
    language: doc.languageId,
    file_path: doc.uri.fsPath,
    selection,
    file_content: doc.getText(),
    workspace_root: workspaceRoot,
    session_id: sessionId,
    recent_edits: recentEdits,
    git_staged_diff: gitDiff,
  };
}

export async function showPatchPreview(title: string, patch: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'diff',
    content: `# ${title}\n\n${patch}`,
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
