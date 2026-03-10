import * as vscode from 'vscode';

export class JsonViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private viewId: string, private title: string) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.getHtml();
  }

  setPayload(payload: unknown): void {
    this.view?.webview.postMessage({ type: 'update', payload });
  }

  focus(): void {
    this.view?.show?.(true);
  }

  private getHtml(): string {
    return `<!doctype html><html><head><meta charset="utf-8" />
<style>body{font-family:var(--vscode-font-family);padding:8px}pre{white-space:pre-wrap;border:1px solid var(--vscode-editorWidget-border);padding:8px;border-radius:6px}</style>
</head><body><h3>${this.title}</h3><pre id="o">No data yet.</pre>
<script>
window.addEventListener('message',(e)=>{const m=e.data;if(m.type==='update'){document.getElementById('o').textContent=JSON.stringify(m.payload,null,2);}})
</script></body></html>`;
  }
}
