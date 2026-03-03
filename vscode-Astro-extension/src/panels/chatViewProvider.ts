import * as vscode from 'vscode';
import { BackendClient } from '../services/backendClient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'astroChatView';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;

  constructor(private context: vscode.ExtensionContext, private backend: BackendClient) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    this.bindWebview(view.webview);
  }

  async focus(): Promise<void> {
    if (this.view) {
      this.view.show?.(true);
      return;
    }

    await vscode.commands.executeCommand('workbench.view.extension.astroMentor');
    await vscode.commands.executeCommand('astroChatView.focus');

    if (this.view) return;

    this.openStandalonePanel();
  }

  private openStandalonePanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'astroChatStandalone',
      'Astro Chat',
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );

    this.bindWebview(this.panel.webview);
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private bindWebview(webview: vscode.Webview): void {
    webview.html = this.getHtml();
    webview.onDidReceiveMessage(async (msg) => {
      if (msg.type !== 'send') return;
      const text = String(msg.text || '').trim();
      if (!text) return;

      const cfg = vscode.workspace.getConfiguration();
      const realtime = Boolean(cfg.get('astro.realtimeDefault', false));

      webview.postMessage({ type: 'assistant-start' });
      try {
        await this.backend.streamChat(text, realtime, (chunk) => {
          webview.postMessage({ type: 'assistant-chunk', chunk });
        });
        webview.postMessage({ type: 'assistant-done' });
      } catch (err: any) {
        webview.postMessage({ type: 'assistant-error', error: String(err?.message || err) });
      }
    });
  }

  private getHtml(): string {
    return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
*{box-sizing:border-box}
body{margin:0;padding:0;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
.wrap{height:100vh;display:flex;flex-direction:column}
.head{padding:10px 12px;border-bottom:1px solid var(--vscode-editorWidget-border);font-weight:600}
#log{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.row{white-space:pre-wrap;max-width:94%;padding:10px 12px;border-radius:10px;line-height:1.45}
.user{align-self:flex-end;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.assistant{align-self:flex-start;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-editorWidget-border)}
.composer{border-top:1px solid var(--vscode-editorWidget-border);padding:10px;display:flex;flex-direction:column;gap:8px}
.input{display:flex;gap:8px}
textarea{width:100%;resize:none;min-height:48px;max-height:180px;padding:10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:8px}
button{padding:8px 12px;border:0;border-radius:8px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}
.hint{font-size:11px;opacity:.8}
</style></head>
<body>
<div class="wrap">
  <div class="head">Astro Chat</div>
  <div id="log"></div>
  <div class="composer">
    <div class="input">
      <textarea id="t" placeholder="Message Astro (Enter = send, Shift+Enter = new line)"></textarea>
      <button id="s">Send</button>
    </div>
    <div class="hint">Codex style chat input ready.</div>
  </div>
</div>
<script>
const vscode = acquireVsCodeApi();
const log = document.getElementById('log');
const t = document.getElementById('t');
let currentAssistant = null;
function add(role,text){const d=document.createElement('div');d.className='row '+role;d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;return d;}
window.addEventListener('message',(e)=>{const m=e.data;
if(m.type==='assistant-start'){currentAssistant=add('assistant','');}
if(m.type==='assistant-chunk'&&currentAssistant){currentAssistant.textContent=(currentAssistant.textContent+m.chunk);}
if(m.type==='assistant-error'){add('assistant','Error: '+m.error);}
});
function autosize(){t.style.height='auto';t.style.height=Math.min(t.scrollHeight,180)+'px';}
function send(){const text=t.value.trim();if(!text)return;add('user',text);vscode.postMessage({type:'send',text});t.value='';autosize();t.focus();}
document.getElementById('s').onclick=send;
t.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
t.addEventListener('input',autosize);
setTimeout(()=>t.focus(),50);
</script>
</body></html>`;
  }
}
