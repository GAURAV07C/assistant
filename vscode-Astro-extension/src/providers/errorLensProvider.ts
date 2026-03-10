import * as vscode from 'vscode';

export class ErrorLensProvider {
  private decoration = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      margin: '0 0 0 14px',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  constructor(private context: vscode.ExtensionContext) {}

  register(): void {
    const refresh = () => this.refreshForEditor(vscode.window.activeTextEditor);

    this.context.subscriptions.push(
      this.decoration,
      vscode.window.onDidChangeActiveTextEditor((e) => this.refreshForEditor(e)),
      vscode.languages.onDidChangeDiagnostics(() => refresh()),
      vscode.workspace.onDidOpenTextDocument(() => refresh()),
    );

    refresh();
  }

  private refreshForEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;
    const diagnostics = vscode.languages
      .getDiagnostics(editor.document.uri)
      .filter((d) => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning)
      .slice(0, 200);

    const ranges = diagnostics.map((d) => {
      const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'Error' : 'Warn';
      return {
        range: new vscode.Range(d.range.end, d.range.end),
        renderOptions: {
          after: {
            contentText: ` ${sev}: ${d.message.replace(/\s+/g, ' ').slice(0, 160)}`,
          },
        },
      } as vscode.DecorationOptions;
    });

    editor.setDecorations(this.decoration, ranges);
  }
}
