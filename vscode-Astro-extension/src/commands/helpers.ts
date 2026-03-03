import * as vscode from 'vscode';
import type { CodeContextPayload } from '../services/backendClient';

export function getCodeContext(sessionId?: string): CodeContextPayload | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const doc = editor.document;
  const selection = editor.selection.isEmpty ? '' : doc.getText(editor.selection);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  return {
    language: doc.languageId,
    file_path: doc.uri.fsPath,
    selection,
    file_content: doc.getText(),
    workspace_root: workspaceRoot,
    session_id: sessionId,
  };
}

export async function showPatchPreview(title: string, patch: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'diff',
    content: `# ${title}\n\n${patch}`,
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
