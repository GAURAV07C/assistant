import * as vscode from 'vscode';
import { getCodeContext } from '../commands/helpers';
import { MemoryEngine } from '../intelligence/memoryEngine';
import { VoiceEngine } from '../intelligence/voiceEngine';
import { JsonViewProvider } from './jsonViewProvider';
import { type AgentMode, BackendClient } from '../services/backendClient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'astroChatView';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;

  constructor(
    private context: vscode.ExtensionContext,
    private backend: BackendClient,
    private memory: MemoryEngine,
    private voice: VoiceEngine,
    private planPanel?: JsonViewProvider,
    private suggestionsPanel?: JsonViewProvider,
  ) {}

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
    void webview.postMessage({
      type: 'bootstrap',
      mode: this.backend.agentMode,
      realtime: Boolean(vscode.workspace.getConfiguration().get('astro.realtimeDefault', false)),
      voiceEnabled: Boolean(vscode.workspace.getConfiguration().get('astro.voiceEnabled', false)),
    });
    this.voice.registerEmitter((text) => this.broadcastVoiceAlert(text));
    void this.pushEvolutionSnapshot(webview, 'bootstrap');

    webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'set-mode') {
        const mode = msg.mode === 'casual' ? 'casual' : 'strategic';
        await this.backend.setAgentMode(mode);
        void vscode.window.setStatusBarMessage(`Astro mode: ${mode}`, 2000);
        return;
      }

      if (msg.type === 'plan') {
        const instruction = String(msg.text || '').trim();
        if (!instruction) return;
        await this.memory.recordTopics(instruction);
        const mode: AgentMode = msg.mode === 'casual' ? 'casual' : 'strategic';
        await this.backend.setAgentMode(mode);

        webview.postMessage({ type: 'agent-start', source: 'plan' });
        try {
          const context = getCodeContext(this.backend.sessionId);
          const resp = await this.backend.planTask({
            user_query: instruction,
            context: context || {},
            forced_mode: mode,
          });

          webview.postMessage({ type: 'agent-payload', source: 'plan', payload: resp });
          await this.pushEvolutionSnapshot(webview, 'plan');
        } catch (err: any) {
          webview.postMessage({ type: 'assistant-error', error: String(err?.message || err) });
        }
        return;
      }

      if (msg.type === 'execute') {
        const instruction = String(msg.text || '').trim();
        if (!instruction) return;
        await this.memory.recordTopics(instruction);
        const mode: AgentMode = msg.mode === 'casual' ? 'casual' : 'strategic';
        await this.backend.setAgentMode(mode);

        webview.postMessage({ type: 'agent-start', source: 'execute' });
        try {
          const context = getCodeContext(this.backend.sessionId);
          let resp = await this.backend.executeTask({
            instruction,
            context: context || {},
            forced_mode: mode,
            confirm: false,
          });

          if (resp?.needs_confirmation || resp?.status === 'clarification_required') {
            const action = await vscode.window.showWarningMessage(
              resp?.detail || resp?.clarification_question || 'Agent needs confirmation/clarification.',
              'Confirm and Continue',
              'Cancel',
            );

            if (action === 'Confirm and Continue') {
              resp = await this.backend.executeTask({
                instruction,
                context: context || {},
                forced_mode: mode,
                confirm: true,
              });
            }
          }

          webview.postMessage({ type: 'agent-payload', source: 'execute', payload: resp });
          await this.pushEvolutionSnapshot(webview, 'execute');
        } catch (err: any) {
          webview.postMessage({ type: 'assistant-error', error: String(err?.message || err) });
        }
        return;
      }

      if (msg.type !== 'send') return;
      const text = String(msg.text || '').trim();
      if (!text) return;

      const mode: AgentMode = msg.mode === 'casual' ? 'casual' : 'strategic';
      const realtime = Boolean(msg.realtime);
      await this.backend.setAgentMode(mode);
      await this.memory.recordTopics(text);

      webview.postMessage({ type: 'assistant-start' });
      try {
        const ctx = getCodeContext(this.backend.sessionId);
        const routed = await this.backend.sendRoutedMessage(text, { realtime, mode }, ctx, (chunk) => {
          webview.postMessage({ type: 'assistant-chunk', chunk });
        });
        webview.postMessage({ type: 'assistant-route', intent: routed.intent, confidence: routed.confidence });
        webview.postMessage({ type: 'assistant-done' });
        await this.pushEvolutionSnapshot(webview, 'chat');
      } catch (err: any) {
        webview.postMessage({ type: 'assistant-error', error: String(err?.message || err) });
      }
    });
  }

  private async pushEvolutionSnapshot(webview: vscode.Webview, source: string): Promise<void> {
    try {
      const [evolution, curriculum, reflection] = await Promise.all([
        this.backend.getEvolutionStatus(),
        this.backend.getCurriculumNext(),
        this.backend.getReflectionRecent(10),
      ]);
      webview.postMessage({ type: 'evolution-update', source, evolution, curriculum, reflection });
      this.planPanel?.setPayload({
        source,
        evolution_summary: evolution?.evaluation_summary || null,
        next_task: curriculum?.next_task || null,
        agents: evolution?.agents || [],
      });
      this.suggestionsPanel?.setPayload({
        source,
        curriculum_next: curriculum || null,
        recent_reflections: reflection?.reviews || [],
      });
    } catch {
      // keep chat flow resilient if evolution endpoints fail
    }
  }

  private getHtml(): string {
    return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
*{box-sizing:border-box}
body{margin:0;padding:0;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
.wrap{height:100vh;display:grid;grid-template-rows:auto 1fr auto}
.head{padding:10px 12px;border-bottom:1px solid var(--vscode-editorWidget-border);font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:8px}
.controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.tag{font-size:11px;opacity:.8}
.tiny{padding:4px 8px;border:1px solid var(--vscode-editorWidget-border);border-radius:999px;background:var(--vscode-editorWidget-background);color:var(--vscode-foreground);cursor:pointer;font-size:11px}
.tiny.active{border-color:var(--vscode-button-background);color:var(--vscode-button-foreground);background:var(--vscode-button-background)}
.voicebar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.voicebar .tiny{border-radius:8px}
.voicebar select,.voicebar input{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:6px;font-size:11px;padding:4px 6px}
.body{display:grid;grid-template-columns:1.5fr 1fr;min-height:0}
#log{overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;border-right:1px solid var(--vscode-editorWidget-border)}
.inspector{overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.card{border:1px solid var(--vscode-editorWidget-border);border-radius:8px;background:var(--vscode-editorWidget-background)}
.card h4{margin:0;padding:8px 10px;border-bottom:1px solid var(--vscode-editorWidget-border);font-size:12px}
.card pre{margin:0;padding:8px 10px;white-space:pre-wrap;font-size:11px;line-height:1.45;max-height:180px;overflow:auto}
.card .summary{padding:8px 10px;font-size:12px;line-height:1.45}
.row{white-space:pre-wrap;max-width:94%;padding:10px 12px;border-radius:10px;line-height:1.45}
.user{align-self:flex-end;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.assistant{align-self:flex-start;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-editorWidget-border)}
.composer{border-top:1px solid var(--vscode-editorWidget-border);padding:10px;display:flex;flex-direction:column;gap:8px}
.input{display:flex;gap:8px}
textarea{width:100%;resize:none;min-height:52px;max-height:180px;padding:10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:8px}
button.send{padding:8px 12px;border:0;border-radius:8px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.actions .tiny{border-radius:8px}
.hint{font-size:11px;opacity:.8}
@media (max-width: 900px){.body{grid-template-columns:1fr}.inspector{border-top:1px solid var(--vscode-editorWidget-border)}}
</style></head>
<body>
<div class="wrap">
  <div class="head">
    <span>Astro Agent Console</span>
    <div class="controls">
      <span class="tag" id="state">strategic | general</span>
      <button class="tiny" id="mCasual">Casual</button>
      <button class="tiny" id="mStrategic">Strategic</button>
      <button class="tiny" id="rToggle">Realtime</button>
      <button class="tiny" id="clearBtn">Clear</button>
    </div>
  </div>
  <div class="head voicebar">
    <span class="tag" id="voiceState">voice off</span>
    <button class="tiny" id="muteBtn">Mute</button>
    <select id="voiceSelect" title="Voice"></select>
    <input id="rateInput" title="Rate" type="number" min="0.6" max="1.6" step="0.1" value="1.0" />
    <button class="tiny" id="testVoiceBtn">Test Voice</button>
  </div>

  <div class="body">
    <div id="log"></div>
    <aside class="inspector">
      <div class="card"><h4>Summary</h4><div class="summary" id="summary">No agent payload yet.</div></div>
      <div class="card"><h4>Plan</h4><pre id="plan">No data</pre></div>
      <div class="card"><h4>Internal Contract</h4><pre id="contract">No data</pre></div>
      <div class="card"><h4>Evaluation</h4><pre id="evaluation">No data</pre></div>
      <div class="card"><h4>Steps / Trace</h4><pre id="steps">No data</pre></div>
      <div class="card"><h4>Evolution</h4><pre id="evolution">No data</pre></div>
      <div class="card"><h4>Curriculum</h4><pre id="curriculum">No data</pre></div>
      <div class="card"><h4>Reflections</h4><pre id="reflections">No data</pre></div>
    </aside>
  </div>

  <div class="composer">
    <div class="input">
      <textarea id="t" placeholder="Message Astro (Enter = send, Shift+Enter = new line)"></textarea>
      <button class="send" id="s">Send</button>
    </div>
    <div class="actions">
      <button class="tiny" id="planBtn">Plan</button>
      <button class="tiny" id="execBtn">Execute</button>
    </div>
    <div class="hint">Codex-style flow: Chat, then Plan or Execute with structured reasoning panel.</div>
  </div>
</div>
<script>
const vscode = acquireVsCodeApi();
const log = document.getElementById('log');
const t = document.getElementById('t');
const state = document.getElementById('state');
const mCasual = document.getElementById('mCasual');
const mStrategic = document.getElementById('mStrategic');
const rToggle = document.getElementById('rToggle');
const summary = document.getElementById('summary');
const plan = document.getElementById('plan');
const contract = document.getElementById('contract');
const evaluation = document.getElementById('evaluation');
const steps = document.getElementById('steps');
const evolution = document.getElementById('evolution');
const curriculum = document.getElementById('curriculum');
const reflections = document.getElementById('reflections');
const voiceState = document.getElementById('voiceState');
const muteBtn = document.getElementById('muteBtn');
const voiceSelect = document.getElementById('voiceSelect');
const rateInput = document.getElementById('rateInput');
const testVoiceBtn = document.getElementById('testVoiceBtn');
let currentAssistant = null;
let mode = 'strategic';
let realtime = false;
let muted = false;
let voiceEnabledBySetting = false;
let voices = [];

function loadVoicePrefs(){
  const state = vscode.getState() || {};
  muted = !!state.muted;
  const savedRate = Number(state.rate || 1);
  rateInput.value = String(Math.min(1.6, Math.max(0.6, savedRate)));
}
function saveVoicePrefs(){
  const current = vscode.getState() || {};
  vscode.setState({...current, muted, rate: Number(rateInput.value || 1), voiceName: voiceSelect.value || ''});
}
function renderVoiceState(){
  const ready = voiceEnabledBySetting ? 'voice on' : 'voice setting off';
  const mutedText = muted ? 'muted' : 'unmuted';
  voiceState.textContent = ready + ' | ' + mutedText;
  muteBtn.classList.toggle('active', muted);
}
function preferredVoice(){
  const saved = (vscode.getState() || {}).voiceName;
  if(saved){
    const exact = voices.find(v => v.name === saved);
    if(exact) return exact;
  }
  return voices.find(v => /en-US|en-IN|hi-IN/i.test(v.lang)) || voices[0] || null;
}
function populateVoices(){
  if(!window.speechSynthesis || !window.speechSynthesis.getVoices) return;
  voices = window.speechSynthesis.getVoices() || [];
  voiceSelect.innerHTML = '';
  if(voices.length === 0){
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Default Voice';
    voiceSelect.appendChild(o);
    return;
  }
  for(const v of voices){
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = v.name + ' (' + v.lang + ')';
    voiceSelect.appendChild(o);
  }
  const pref = preferredVoice();
  if(pref) voiceSelect.value = pref.name;
}
function speakText(text){
  if(!voiceEnabledBySetting || muted) return;
  if(!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') return;
  try{
    const u = new SpeechSynthesisUtterance(String(text || '').trim());
    u.rate = Number(rateInput.value || 1);
    const selected = voices.find(v => v.name === voiceSelect.value);
    if(selected) u.voice = selected;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{}
}

function add(role,text){const d=document.createElement('div');d.className='row '+role;d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;return d;}
function renderState(){
  state.textContent = mode + ' | ' + (realtime ? 'realtime' : 'general');
  mCasual.classList.toggle('active', mode==='casual');
  mStrategic.classList.toggle('active', mode==='strategic');
  rToggle.classList.toggle('active', realtime);
}
function pretty(v){try{return JSON.stringify(v,null,2);}catch{return String(v);}}
function renderAgentPayload(source,payload){
  const p = payload || {};
  const planObj = p.plan || null;
  const contractObj = p.internal_contract || null;
  const evalObj = p.evaluation || null;
  const trace = Array.isArray(planObj && planObj.steps) ? planObj.steps : (Array.isArray(p.execution_trace) ? p.execution_trace : []);

  summary.textContent = p.clarification_question
    ? ('Clarification required (' + source + '): ' + p.clarification_question)
    : (p.result || (planObj && planObj.goal ? ('Goal: ' + planObj.goal) : ('Agent payload received (' + source + ')')));

  plan.textContent = pretty(planObj || 'No data');
  contract.textContent = pretty(contractObj || 'No data');
  evaluation.textContent = pretty(evalObj || 'No data');
  steps.textContent = trace.length ? trace.map((s,i)=> (i+1)+'. '+(typeof s==='string'?s:pretty(s))).join('\n') : 'No data';
}

window.addEventListener('message',(e)=>{
  const m=e.data;
  if(m.type==='bootstrap'){
    mode = m.mode === 'casual' ? 'casual' : 'strategic';
    realtime = !!m.realtime;
    voiceEnabledBySetting = !!m.voiceEnabled;
    renderState();
    renderVoiceState();
  }
  if(m.type==='assistant-start'){currentAssistant=add('assistant','');}
  if(m.type==='assistant-chunk'&&currentAssistant){currentAssistant.textContent=(currentAssistant.textContent+m.chunk);}
  if(m.type==='assistant-done'){currentAssistant=null;}
  if(m.type==='assistant-error'){add('assistant','Error: '+m.error);currentAssistant=null;}
  if(m.type==='assistant-route'){add('assistant','[intent: '+m.intent+' · confidence: '+m.confidence+']');}
  if(m.type==='voice-alert'){
    speakText(String(m.text || ''));
  }
  if(m.type==='agent-start'){add('assistant','['+(m.source||'agent')+'] running...');}
  if(m.type==='agent-payload'){renderAgentPayload(m.source||'agent',m.payload);add('assistant','['+(m.source||'agent')+'] done');}
  if(m.type==='evolution-update'){
    evolution.textContent = pretty(m.evolution || 'No data');
    curriculum.textContent = pretty(m.curriculum || 'No data');
    reflections.textContent = pretty(m.reflection || 'No data');
  }
});

function autosize(){t.style.height='auto';t.style.height=Math.min(t.scrollHeight,180)+'px';}
function send(){
  const text=t.value.trim();
  if(!text)return;
  add('user',text);
  vscode.postMessage({type:'send',text,mode,realtime});
  t.value='';
  autosize();
  t.focus();
}
function planTask(){
  const text=t.value.trim();
  if(!text)return;
  add('user','[plan] '+text);
  vscode.postMessage({type:'plan',text,mode});
}
function executeTask(){
  const text=t.value.trim();
  if(!text)return;
  add('user','[execute] '+text);
  vscode.postMessage({type:'execute',text,mode});
}

mCasual.onclick=()=>{mode='casual';renderState();vscode.postMessage({type:'set-mode',mode});};
mStrategic.onclick=()=>{mode='strategic';renderState();vscode.postMessage({type:'set-mode',mode});};
rToggle.onclick=()=>{realtime=!realtime;renderState();};
document.getElementById('clearBtn').onclick=()=>{log.textContent='';summary.textContent='No agent payload yet.';plan.textContent='No data';contract.textContent='No data';evaluation.textContent='No data';steps.textContent='No data';evolution.textContent='No data';curriculum.textContent='No data';reflections.textContent='No data';};
document.getElementById('planBtn').onclick=planTask;
document.getElementById('execBtn').onclick=executeTask;
document.getElementById('s').onclick=send;
muteBtn.onclick=()=>{muted=!muted;saveVoicePrefs();renderVoiceState();};
voiceSelect.onchange=()=>saveVoicePrefs();
rateInput.onchange=()=>saveVoicePrefs();
testVoiceBtn.onclick=()=>speakText('Astro voice check complete.');
t.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
t.addEventListener('input',autosize);
loadVoicePrefs();
populateVoices();
if(window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined){
  window.speechSynthesis.onvoiceschanged = () => { populateVoices(); };
}
setTimeout(()=>{renderState();renderVoiceState();t.focus();},50);
</script>
</body></html>`;
  }

  private broadcastVoiceAlert(text: string): void {
    const payload = { type: 'voice-alert', text };
    try {
      this.view?.webview.postMessage(payload);
    } catch {
      // ignore
    }
    try {
      this.panel?.webview.postMessage(payload);
    } catch {
      // ignore
    }
  }
}
