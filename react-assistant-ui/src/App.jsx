import { useEffect, useMemo, useRef, useState } from 'react';

const API = (typeof window !== 'undefined' && window.location?.origin)
  ? window.location.origin
  : 'http://localhost:8000';

const actionNodes = [
  { title: 'ADD FILES', subtitle: 'UPLOAD CONTEXT', tone: 'cyan', action: 'files' },
  { title: 'MEMORY', subtitle: 'SYSTEM ACCESS', tone: 'red', action: 'memory' },
  { title: 'HISTORY', subtitle: 'PAST LOGS', tone: 'blue', action: 'audit' },
  { title: 'USER', subtitle: 'PROFILE NODE', tone: 'white', action: 'profile' },
];

class TTSPlayer {
  constructor() {
    this.queue = [];
    this.playing = false;
    this.enabled = true;
    this.stopped = false;
    this.fallbackEnabled = true;
    this.fallbackStreamBuffer = '';
    this.audio = new Audio();
    this.audio.preload = 'auto';
  }

  unlock() {
    const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    this.audio.src = silentWav;
    const p = this.audio.play();
    if (p) p.catch(() => {});
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this.stop();
  }

  stop() {
    this.stopped = true;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.queue = [];
    this.playing = false;
    this.fallbackStreamBuffer = '';
  }

  reset() {
    this.stop();
    this.stopped = false;
  }

  enqueue(base64Audio) {
    if (!this.enabled || this.stopped) return;
    this.queue.push(base64Audio);
    if (!this.playing) this.playLoop();
  }

  async playLoop() {
    if (this.playing) return;
    this.playing = true;
    while (this.queue.length > 0 && !this.stopped) {
      const b64 = this.queue.shift();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        this.audio.src = `data:audio/mp3;base64,${b64}`;
        this.audio.onended = () => resolve();
        this.audio.onerror = () => resolve();
        const p = this.audio.play();
        if (p) p.catch(() => resolve());
      });
    }
    this.playing = false;
  }

  preferredVoice() {
    if (!window.speechSynthesis?.getVoices) return undefined;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => /^hi-IN$/i.test(v.lang))
      || voices.find((v) => /^en-IN$/i.test(v.lang))
      || voices.find((v) => /india|hindi|hinglish/i.test(`${v.name} ${v.lang}`));
  }

  speakFallback(text, append = false) {
    if (!this.enabled || this.stopped || !this.fallbackEnabled) return;
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') return;
    const content = String(text || '').trim();
    if (!content) return;

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'hi-IN';
    utterance.rate = 1;
    utterance.pitch = 1;
    const v = this.preferredVoice();
    if (v) utterance.voice = v;

    if (!append) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  pushFallbackChunk(chunk) {
    if (!this.enabled || this.stopped || !this.fallbackEnabled) return false;
    this.fallbackStreamBuffer += String(chunk || '');
    const parts = this.fallbackStreamBuffer.split(/(?<=[.!?])\s+/);
    if (parts.length <= 1) return false;
    this.fallbackStreamBuffer = parts.pop() || '';
    let spoke = false;
    for (const sentence of parts) {
      const s = sentence.trim();
      if (!s) continue;
      this.speakFallback(s, true);
      spoke = true;
    }
    return spoke;
  }

  flushFallbackStream() {
    const rem = this.fallbackStreamBuffer.trim();
    this.fallbackStreamBuffer = '';
    if (rem) this.speakFallback(rem, true);
  }
}

function App() {
  const [mode, setMode] = useState('general');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [health, setHealth] = useState('CHECKING');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [searchPayload, setSearchPayload] = useState(null);
  const [memoryProfile, setMemoryProfile] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeRightTab, setActiveRightTab] = useState('chat');
  const [statusLine, setStatusLine] = useState('ASTRO_ONLINE');

  const ttsRef = useRef(new TTSPlayer());
  const transcriptRef = useRef(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    ttsRef.current.setEnabled(ttsEnabled);
  }, [ttsEnabled]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API}/health`);
        if (!res.ok) throw new Error('health failed');
        setHealth('ONLINE');
      } catch {
        setHealth('OFFLINE');
      }
    };
    run();
    void fetchMemory();
    void fetchAudit();
  }, []);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, streaming]);

  async function fetchMemory() {
    try {
      const res = await fetch(`${API}/memory/profile`);
      if (!res.ok) throw new Error('memory failed');
      const data = await res.json();
      setMemoryProfile(data);
    } catch {
      setMemoryProfile(null);
    }
  }

  async function fetchAudit() {
    try {
      const res = await fetch(`${API}/audit/recent?limit=20`);
      if (!res.ok) throw new Error('audit failed');
      const data = await res.json();
      setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      setAuditLogs([]);
    }
  }

  async function upsertProfileTouch() {
    try {
      await fetch(`${API}/memory/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: 'profile',
          key: 'last_ui_ping',
          value: { ts: new Date().toISOString(), mode },
          tags: ['ui', 'react-interface'],
        }),
      });
      await fetchMemory();
      setStatusLine('ASTRO_MEMORY_SYNCED');
    } catch {
      setStatusLine('ASTRO_MEMORY_SYNC_FAILED');
    }
  }

  async function sendMessage(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: '' }]);
    setStreaming(true);
    setStatusLine('ASTRO_STREAMING');

    const tts = ttsRef.current;
    tts.reset();
    tts.unlock();

    const endpoint = mode === 'realtime' ? '/chat/realtime/stream' : '/chat/stream';
    let fullResponse = '';
    let receivedAudio = false;
    let usedFallbackStreaming = false;

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId, tts: ttsEnabled }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (data.session_id) setSessionId(data.session_id);
          if (data.search_results) setSearchPayload(data.search_results);

          if (data.chunk) {
            fullResponse += data.chunk;
            setMessages((prev) => {
              const next = [...prev];
              const idx = next.length - 1;
              if (idx >= 0 && next[idx].role === 'assistant') {
                next[idx] = { ...next[idx], text: fullResponse };
              }
              return next;
            });
            if (!receivedAudio && ttsEnabled) {
              usedFallbackStreaming = tts.pushFallbackChunk(data.chunk) || usedFallbackStreaming;
            }
          }

          if (data.audio && ttsEnabled) {
            if (!receivedAudio) {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              tts.fallbackStreamBuffer = '';
            }
            receivedAudio = true;
            tts.enqueue(data.audio);
          }

          if (data.error) throw new Error(data.error);
        }
      }

      if (ttsEnabled && !receivedAudio) {
        if (usedFallbackStreaming) tts.flushFallbackStream();
        else if (fullResponse) tts.speakFallback(fullResponse);
      }

      setStatusLine('ASTRO_ONLINE');
    } catch (err) {
      const msg = `Something went wrong: ${err.message || String(err)}`;
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0 && next[idx].role === 'assistant' && !next[idx].text) {
          next[idx] = { role: 'assistant', text: msg };
        } else {
          next.push({ role: 'assistant', text: msg });
        }
        return next;
      });
      setStatusLine('ASTRO_ERROR');
    } finally {
      setStreaming(false);
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setSearchPayload(null);
    ttsRef.current.reset();
    setStatusLine('ASTRO_SESSION_RESET');
  }

  const rightItems = useMemo(() => {
    if (activeRightTab === 'logs') {
      return auditLogs.map((log, idx) => ({
        role: log.status === 'blocked' ? 'ALERT' : 'LOG',
        text: `${log.route} · ${log.action} · ${log.status} · ${new Date(log.ts).toLocaleTimeString()}`,
        key: `log-${idx}`,
      }));
    }
    return messages.map((m, idx) => ({ role: m.role === 'assistant' ? 'ASTRO_RESPONSE' : 'USER_CMD', text: m.text, key: `msg-${idx}` }));
  }, [activeRightTab, auditLogs, messages]);

  return (
    <div className="shell">
      <div className="scan" />
      <div className="window-shell">
        <div className="window-top">
          <span>Astro Desktop</span>
          <div className="dots">
            <i />
            <i />
            <i />
          </div>
        </div>

        <header className="topbar glass">
          <div className="brand-wrap">
            <div className="brand">ASTRO</div>
            <small>Neural Command Interface</small>
          </div>
          <nav className="tabs">
            <button className="tab active">Intelligence</button>
            <button className="tab">Notes</button>
            <button className="tab">Tasks</button>
            <button className="tab">Contacts</button>
          </nav>
          <button className="gear" aria-label="new-chat" onClick={newChat}>⚙</button>
        </header>

        <main className="grid">
          <section className="left glass">
            <div className="camera card">
              <div className="camera-icon">📷</div>
              <div className="camera-off">camera offline</div>
              <div className="health-pill">{health}</div>
            </div>
            <div className="headlines card">
              <div className="card-title">Today Headlines</div>
              <ul>
                <li>records: {memoryProfile?.records_count ?? 0}</li>
                <li>learning files: {memoryProfile?.learning_files?.length ?? 0}</li>
                <li>session: {sessionId ? sessionId.slice(0, 8) : 'new'}</li>
              </ul>
            </div>
          </section>

          <section className="center">
            <div className="pipeline glass">
              <aside className="mini-nav card">
                <button onClick={() => setMode('general')} className={mode === 'general' ? 'active-mini' : ''}>REPORT</button>
                <button onClick={() => setMode('realtime')} className={mode === 'realtime' ? 'active-mini' : ''}>ASTRO_DSCP</button>
                <button onClick={() => setTtsEnabled((v) => !v)} className={ttsEnabled ? 'active-mini' : ''}>MY DOCS</button>
              </aside>

              <div className="node-stack">
                {actionNodes.map((item) => (
                  <button
                    key={item.title}
                    className={`node ${item.tone}`}
                    onClick={() => {
                      if (item.action === 'memory') void fetchMemory();
                      if (item.action === 'audit') {
                        setActiveRightTab('logs');
                        void fetchAudit();
                      }
                      if (item.action === 'profile') void upsertProfileTouch();
                      if (item.action === 'files') setStatusLine('ASTRO_UPLOAD_HOOK_PENDING');
                    }}
                  >
                    <span>{item.title}</span>
                    <small>{item.subtitle}</small>
                  </button>
                ))}
              </div>

              <div className="pipe-link" />
              <div className="orb-card card">
                <div className="orb-ring outer" />
                <div className="orb-ring inner" />
                <div className="orb" />
                <p>{streaming ? 'STANDBY MODE' : 'STANDBY MODE'}</p>
                <button onClick={() => sendMessage()} disabled={streaming || !input.trim()}>
                  {streaming ? 'PROCESSING...' : 'INITIALIZE AI'}
                </button>
              </div>
            </div>

            <div className="hub glass">
              <div className="hub-chip">VISUAL HUB</div>
              <div className="hub-title">VISUAL INTELLIGENCE HUB</div>
              <p>{searchPayload?.query ? `Realtime query: ${searchPayload.query}` : 'Images, flowcharts, and mindmaps will materialize here.'}</p>
              <span>{searchPayload?.answer ? searchPayload.answer.slice(0, 120) : 'SYSTEM READY · AWAITING DATA INPUT'}</span>
            </div>
          </section>

          <section className="right glass">
            <div className="panel-head">SYSTEM_TRANSCRIPTION <span className={streaming ? 'live on' : 'live'}>LIVE</span></div>
            <div className="chat-toggle">
              <button className={`small ${activeRightTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveRightTab('chat')}>CHAT</button>
              <button className={`small ${activeRightTab === 'logs' ? 'active' : ''}`} onClick={() => { setActiveRightTab('logs'); void fetchAudit(); }}>LOGS</button>
            </div>
            <div className="drop">
              {mode === 'realtime' ? 'DEEP REASONING MODE' : 'FAST RESPONSE MODE'}
              <span className="mode-pill">{mode === 'realtime' ? 'REALTIME' : 'GENERAL'}</span>
            </div>

            <div className="transcript" ref={transcriptRef}>
              {!hasMessages && activeRightTab === 'chat' ? (
                <div className="empty">Start conversation from the input below.</div>
              ) : rightItems.map((entry) => (
                <div key={entry.key} className={`bubble ${entry.role === 'USER_CMD' ? 'user' : 'ai'}`}>
                  <strong>{entry.role}</strong>
                  <p>{entry.text || (streaming ? '...' : '(empty)')}</p>
                </div>
              ))}
            </div>

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your command..."
                rows={2}
                maxLength={32000}
              />
              <button type="submit" disabled={streaming || !input.trim()}>{streaming ? '...' : 'SEND'}</button>
            </form>

            <div className={`state ${health === 'ONLINE' ? 'ok' : 'bad'}`}>{statusLine}</div>
          </section>
        </main>

        <div className="taskbar">
          <div className="weather">17°C Sunny</div>
          <div className="task-icons">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="clock">12:37 PM</div>
        </div>
      </div>
    </div>
  );
}

export default App;
