'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from '../Sidebar/Sidebar';
import { ChatInput } from '../Chat/ChatInput';
import { ChatWindow, type ChatMessage } from '../Chat/ChatWindow';
import { AgentCard } from '../Agents/AgentCard';
import { MemoryViewer, type MemoryEntry } from '../Memory/MemoryViewer';
import { SkillCard } from '../Skills/SkillCard';
import { SystemControls } from '../System/SystemControls';
import { LogConsole } from '../Logs/LogConsole';
import { MetricCard } from '../Common/MetricCard';
import { useAIOSWebSocket } from '../../lib/useAIOSWebSocket';
import { AccordionGroup } from '../ui/accordion';
import type { KeyProvider } from '../../lib/useAIOSWebSocket';
import { ArchitectureEvolutionPanel } from './ArchitectureEvolutionPanel';
import { CodeAwarenessPanel } from './CodeAwarenessPanel';
import { SelfUpgradePanel } from './SelfUpgradePanel';
import { VoiceControlCenter } from '../Voice/VoiceControlCenter';

export function AIOSDashboardShell({ section }: { section: 'dashboard' | 'chat' | 'agents' | 'memory' | 'skills' | 'research' | 'system' | 'settings' }) {
  const {
    connected,
    agents,
    logs,
    reasoningSteps,
    activeAgent,
    streamChunk,
    thinking,
    sendPrompt,
    sendSystemAction,
    requestRealtimeSnapshot,
    snapshot,
    skills,
    memoryProfile,
    auditLogs,
    health,
    metrics,
    apiKeysInfo,
    providerModels,
    requestApiKeys,
    updateApiKeys,
    requestProviderModels,
    updateProviderModels,
    recallDebug,
  } = useAIOSWebSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [voicePreview, setVoicePreview] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Aurora');
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<KeyProvider, string[]>>({
    groq: [''],
    openrouter: [''],
    gemini: [''],
    tavily: [''],
  });
  const [openRouterModelDraft, setOpenRouterModelDraft] = useState<string[]>(['']);
  const [recallQuery, setRecallQuery] = useState('');
  const [recallResult, setRecallResult] = useState<any>(null);
  const [recallLoading, setRecallLoading] = useState(false);
  const [recallError, setRecallError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const streamChunkRef = useRef('');

  useEffect(() => {
    const handler = (event: Event) => {
      if ('prompt' in event) {
        event.preventDefault();
        setInstallPrompt(event as BeforeInstallPromptEvent);
      }
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!voiceSample) {
      setVoicePreview('');
      return;
    }
    const url = URL.createObjectURL(voiceSample);
    setVoicePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [voiceSample]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || voiceMuted || typeof window === 'undefined') return;
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') return;
    const t = String(text || '').trim();
    if (!t) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(t.slice(0, 1200));
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      const match = voices.find((voice) => voice.name.toLowerCase().includes(selectedVoice.toLowerCase()));
      if (match) utter.voice = match;
    }
    utter.lang = 'en-IN';
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }, [voiceEnabled, voiceMuted, selectedVoice]);

  useEffect(() => {
    if (!streamChunk) {
      streamChunkRef.current = '';
      return;
    }
    if (streamChunk.length <= streamChunkRef.current.length) {
      streamChunkRef.current = streamChunk;
      return;
    }
    const delta = streamChunk.slice(streamChunkRef.current.length);
    streamChunkRef.current = streamChunk;
    speak(delta);
  }, [streamChunk, speak]);
  const skillCards = useMemo(() => {
    if (!skills.length) return [];
    return skills.slice(0, 8).map((s: any) => ({
      name: String(s.name || s.id || 'unknown'),
      level: Number(s.intelligence_score || 0),
      xp: Number(s.usage_count || 0) * 100,
      lastUsed: s.updated_at ? new Date(String(s.updated_at)).toLocaleTimeString() : 'n/a',
    }));
  }, [skills]);

  const memoryEntries = useMemo<MemoryEntry[]>(() => {
    const out: MemoryEntry[] = [];
    if (memoryProfile?.profile_memory) {
      out.push({
        id: 'mem_profile',
        type: 'long_term',
        title: 'Profile Memory',
        content: JSON.stringify(memoryProfile.profile_memory).slice(0, 600),
        relationships: ['profile -> preferences'],
      });
    }
    const nodes = snapshot?.intelligence_graph?.nodes || [];
    const edges = snapshot?.intelligence_graph?.edges || [];
    nodes.slice(0, 8).forEach((n: any, idx: number) => {
      out.push({
        id: `kg_${idx}`,
        type: 'knowledge_graph',
        title: `Knowledge Node: ${String(n.id || 'node')}`,
        content: `Weight ${String(n.weight || 0)}`,
        relationships: edges.filter((e: any) => e.from === n.id || e.to === n.id).slice(0, 3).map((e: any) => `${e.from} -> ${e.to}`),
      });
    });
    const vectors = Number(snapshot?.vector_memory?.total_vectors || 0);
    out.push({
      id: 'vector_state',
      type: 'vector',
      title: 'Vector Memory State',
      content: `Total vectors: ${vectors}; latest: ${String(snapshot?.vector_memory?.latest_update || 'n/a')}`,
      relationships: ['vector -> retrieval_engine', 'vector -> semantic_search'],
    });
    return out;
  }, [memoryProfile, snapshot]);
  const mergedLogs = useMemo(() => {
    const fromAudit = (auditLogs || []).slice(0, 30).map((a: any, idx: number) => ({
      id: `audit_${idx}_${a.ts || Date.now()}`,
      ts: a.ts || new Date().toISOString(),
      level: (a.status === 'error' ? 'error' : a.status === 'blocked' ? 'warn' : 'info') as 'info' | 'warn' | 'error',
      message: `${a.action || 'event'} @ ${a.route || 'system'}`,
    }));
    return [...logs, ...fromAudit].slice(0, 180);
  }, [logs, auditLogs]);

  const handleSendPrompt = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text }]);
    try {
      const out = await sendPrompt(text);
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: out.response, executedBy: out.agent, thinking: out.steps }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: `Socket chat failed: ${String(err)}`, executedBy: 'System Agent' }]);
    }
  }, [sendPrompt, speak]);

  const handleVoiceUpload = useCallback((file: File | null) => {
    setVoiceSample(file);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => !prev);
  }, []);

  const toggleMute = useCallback(() => {
    setVoiceMuted((prev) => !prev);
  }, []);

  const handleVoiceTrigger = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      {
        id: `voice_${Date.now()}`,
        role: 'assistant',
        text: 'Voice hub ready. Boliye, boss.',
        executedBy: 'Voice Control',
      },
    ]);
    setVoiceEnabled(true);
  }, []);

  const friendlyMessage = useMemo(() => {
    if (!thinking) return '';
    const agentLabel = activeAgent || 'casual_conversation';
    if (agentLabel === 'casual_conversation') return '';
    return `Main ${agentLabel.replace(/_/g, ' ')} agent ke saath gahraai se kaam kar raha hoon. Koi aur hint chahiye?`;
  }, [thinking, activeAgent]);

  useEffect(() => {
    if (!connected) return;
    requestApiKeys('groq');
    requestApiKeys('openrouter');
    requestApiKeys('gemini');
    requestApiKeys('tavily');
    requestProviderModels('openrouter');
  }, [connected, requestApiKeys, requestProviderModels]);

  useEffect(() => {
    if (!providerModels.openrouter.models.length) return;
    setOpenRouterModelDraft(providerModels.openrouter.models);
  }, [providerModels.openrouter.models]);

  const normalizedDrafts = useMemo(() => ({
    groq: Array.from(new Set(apiKeyDrafts.groq.map((k) => k.trim()).filter(Boolean))),
    openrouter: Array.from(new Set(apiKeyDrafts.openrouter.map((k) => k.trim()).filter(Boolean))),
    gemini: Array.from(new Set(apiKeyDrafts.gemini.map((k) => k.trim()).filter(Boolean))),
    tavily: Array.from(new Set(apiKeyDrafts.tavily.map((k) => k.trim()).filter(Boolean))),
  }), [apiKeyDrafts]);

  const rightPanel = (
    <AccordionGroup
      items={[
        {
          id: 'agent_monitor',
          title: 'Agent Monitor',
          subtitle: 'Live runtime status',
          content: (
            <div className="space-y-2">
              {agents.length ? agents.map((agent: any) => (
                <AgentCard
                  key={agent.id}
                  name={agent.name}
                  status={agent.status}
                  progress={agent.progress}
                  executionTimeMs={agent.executionTimeMs}
                />
              )) : <div className="text-xs text-slate-400">No live agent events yet.</div>}
            </div>
          ),
        },
        {
          id: 'live_metrics',
          title: 'Live System Metrics',
          subtitle: connected ? 'WebSocket connected' : 'WebSocket disconnected',
          content: (
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="CPU Usage" value={metrics ? `${metrics.cpu}%` : 'n/a'} />
              <MetricCard label="Memory Usage" value={metrics ? `${metrics.memory}%` : 'n/a'} />
              <MetricCard label="Active Tasks" value={metrics?.activeTasks ?? snapshot?.task_memory?.success?.total ?? 0} />
              <MetricCard label="System Health" value={metrics?.health ? String(metrics.health).toUpperCase() : health?.status ? String(health.status).toUpperCase() : 'UNKNOWN'} />
              <MetricCard label="Intelligence" value={snapshot?.system_intelligence_score ?? 'n/a'} hint="From /evolution/status" />
            </div>
          ),
        },
      ]}
    />
  );

  const centerContent = useMemo(() => {
    if (section === 'dashboard') {
      const insights = [
        { label: 'Intelligence', value: snapshot?.system_intelligence_score ?? 'n/a' },
        { label: 'Knowledge nodes', value: snapshot?.intelligence_graph?.nodes?.length ?? 0 },
        { label: 'Vector size', value: snapshot?.vector_memory?.total_vectors ?? 0 },
        { label: 'Active agents', value: agents.length },
      ];
      return (
        <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <CodeAwarenessPanel />
              <ArchitectureEvolutionPanel />
            </div>
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-amber-300/80">AI Insights</p>
                  <h3 className="text-lg font-semibold text-white">System Health</h3>
                </div>
                <span className="text-xs text-slate-400">Derived from awareness</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                {insights.map((insight) => (
                  <div key={`insight_${insight.label}`} className="rounded-xl border border-slate-800 bg-black/30 p-3">
                    <div className="text-xs text-slate-400">{insight.label}</div>
                    <div className="text-2xl font-semibold text-white">{insight.value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Architecture awareness, vector memory, and agent telemetry now feed into this dashboard—sab tumhare liye ready hai.
              </p>
            </section>
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 shadow-2xl shadow-slate-950/30">
              <div className="grid gap-4 text-sm">
                <div className="flex justify-center">
                  <VoiceControlCenter
                    voiceEnabled={voiceEnabled}
                    voiceMuted={voiceMuted}
                    selectedVoice={selectedVoice}
                    voiceFile={voiceSample}
                    voicePreview={voicePreview}
                    onToggleVoice={toggleVoice}
                    onToggleMute={toggleMute}
                    onSelectVoice={setSelectedVoice}
                    onUploadVoice={handleVoiceUpload}
                    onTriggerVoiceChat={handleVoiceTrigger}
                  />
                </div>
                <ChatWindow
                  messages={messages}
                  thinking={thinking}
                  reasoningSteps={reasoningSteps}
                  activeAgent={activeAgent}
                  streamChunk={streamChunk}
                  friendlyMessage={friendlyMessage}
                />
              </div>
              <ChatInput
                disabled={thinking}
                voiceEnabled={voiceEnabled}
                onVoiceEnabledChange={setVoiceEnabled}
                onSend={handleSendPrompt}
              />
            </section>
          </div>
          <div className="space-y-4">
            <SelfUpgradePanel />
            <section className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-2xl shadow-cyan-800/30">
              <h3 className="text-sm font-semibold text-cyan-200">Companion Notes</h3>
              <p className="mt-2 text-xs text-slate-300">
                Main tumhe real-time me acknowledge karta hoon. Jab bhi kuch heavy chal raha ho, thoda patience rakhna—main tumhare liye detail laata hoon.
              </p>
              <p className="mt-3 text-xs text-slate-400">Chat ke neeche wali log window se tum har agent activity, memory trigger, aur architecture event dekh sakte ho.</p>
            </section>
          </div>
        </div>
      );
    }

    if (section === 'agents') {
      return (
        <AccordionGroup
          items={[{
            id: 'agents_all',
            title: 'Active Agents',
            subtitle: 'Execution cards',
            content: (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {agents.map((a) => <AgentCard key={a.id} name={a.name} status={a.status} progress={a.progress} executionTimeMs={a.executionTimeMs} />)}
              </div>
            ),
          }]}
        />
      );
    }

    if (section === 'memory') {
      return (
        <AccordionGroup
          items={[
            {
              id: 'memory_explorer',
              title: 'Memory Explorer',
              subtitle: 'Short term, long term, vector, graph',
              content: <MemoryViewer entries={memoryEntries} />,
            },
            {
              id: 'memory_recall_debug',
              title: 'Recall Debug',
              subtitle: 'Test what memory gets injected',
              content: (
                <div className="space-y-3 text-sm text-slate-300">
                  <textarea
                    value={recallQuery}
                    onChange={(e) => setRecallQuery(e.target.value)}
                    placeholder="Type a query to inspect memory recall..."
                    className="min-h-24 w-full rounded-md border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-100 outline-none transition focus:border-cyan-500/60"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setRecallLoading(true);
                        setRecallError('');
                        try {
                          const out = await recallDebug(recallQuery);
                          setRecallResult(out);
                        } catch (err) {
                          setRecallError(String(err));
                        } finally {
                          setRecallLoading(false);
                        }
                      }}
                      disabled={!recallQuery.trim() || recallLoading}
                      className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {recallLoading ? 'Running...' : 'Run Recall Debug'}
                    </button>
                  </div>
                  {recallError ? <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">{recallError}</div> : null}
                  {recallResult ? (
                    <pre className="max-h-72 overflow-auto rounded border border-slate-800/70 bg-black/25 p-2 text-xs">
                      {JSON.stringify(recallResult, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      );
    }

    if (section === 'skills') {
      if (!skillCards.length) return <div className="rounded-xl border border-slate-800/80 bg-slate-950/65 p-4 text-sm text-slate-300">No skill data from backend.</div>;
      return (
        <AccordionGroup
          items={[{
            id: 'skills_matrix',
            title: 'Skill Matrix',
            subtitle: 'Levels, XP, last used',
            content: <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{skillCards.map((s) => <SkillCard key={s.name} {...s} />)}</div>,
          }]}
        />
      );
    }

    if (section === 'system') {
      return (
        <AccordionGroup
          items={[{
            id: 'system_controls',
            title: 'System Controls',
            subtitle: 'Runtime actions',
            content: (
              <SystemControls onAction={(action) => {
                try {
                  sendSystemAction(action);
                } catch (err) {
                  setMessages((prev) => [...prev, { id: `sys_${Date.now()}`, role: 'assistant', text: `System action failed: ${String(err)}`, executedBy: 'System Agent' }]);
                }
              }} />
            ),
          }]}
        />
      );
    }

    if (section === 'research') {
      return (
        <AccordionGroup
          items={[{
            id: 'research_live',
            title: 'Research Intelligence',
            subtitle: 'Autonomous loop monitor',
            content: (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Autonomous research loop is active and synchronized with agent orchestration.</p>
                <p>Live topic extraction, document ingestion, and knowledge updates are visible through logs.</p>
                <pre className="max-h-48 overflow-auto rounded border border-slate-800/70 bg-black/25 p-2 text-xs">
                  {JSON.stringify(snapshot?.autonomous_research || {}, null, 2)}
                </pre>
              </div>
            ),
          }]}
        />
      );
    }

    if (section === 'settings') {
      return (
        <AccordionGroup
          items={[{
            id: 'settings_live',
            title: 'Settings',
            subtitle: 'Realtime transport',
            content: (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Configure websocket endpoint using <code>NEXT_PUBLIC_AIOS_WS_URL</code>.</p>
                <p>No polling is used. Data flow is socket-driven only.</p>
                {(['groq', 'openrouter', 'gemini', 'tavily'] as KeyProvider[]).map((provider) => (
                  <div key={provider} className="space-y-2 rounded-lg border border-slate-800/70 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-300">
                        {provider.toUpperCase()} API Keys (runtime): {apiKeysInfo[provider]?.count ?? 0}
                      </div>
                      <button
                        type="button"
                        onClick={() => requestApiKeys(provider)}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-500/50"
                      >
                        Refresh Keys
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(apiKeyDrafts[provider] || []).map((key, idx) => (
                        <div key={`${provider}_key_${idx}`} className="flex items-center gap-2">
                          <input
                            type="password"
                            value={key}
                            onChange={(e) => {
                              setApiKeyDrafts((prev) => {
                                const next = { ...prev };
                                next[provider] = [...next[provider]];
                                next[provider][idx] = e.target.value;
                                return next;
                              });
                            }}
                            placeholder={`Enter ${provider} API key`}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-cyan-500/60"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setApiKeyDrafts((prev) => {
                                const next = { ...prev };
                                next[provider] = next[provider].length > 1 ? next[provider].filter((_, i) => i !== idx) : next[provider];
                                return next;
                              });
                            }}
                            className="rounded-md border border-slate-700 px-2 py-2 text-xs text-slate-200 transition hover:border-rose-500/60"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setApiKeyDrafts((prev) => ({ ...prev, [provider]: [...prev[provider], ''] }));
                        }}
                        className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        Add Key
                      </button>
                      <button
                        type="button"
                        onClick={() => updateApiKeys(provider, normalizedDrafts[provider])}
                        disabled={normalizedDrafts[provider].length === 0}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save Keys
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-slate-400">
                      <div>Active masked keys:</div>
                      {(apiKeysInfo[provider]?.masked || []).length ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {(apiKeysInfo[provider]?.masked || []).map((m, i) => <li key={`${provider}_mask_${i}`}>{m}</li>)}
                        </ul>
                      ) : (
                        <div>No active runtime keys found.</div>
                      )}
                    </div>
                    {provider === 'openrouter' ? (
                      <div className="space-y-2 rounded-md border border-slate-700/70 bg-slate-900/30 p-2">
                        <div className="text-xs text-slate-300">OpenRouter Model Router (free models fallback)</div>
                        <div className="space-y-2">
                          {openRouterModelDraft.map((model, idx) => (
                            <div key={`or_model_${idx}`} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={model}
                                onChange={(e) => {
                                  const next = [...openRouterModelDraft];
                                  next[idx] = e.target.value;
                                  setOpenRouterModelDraft(next);
                                }}
                                placeholder="example: qwen/qwen-2.5-7b-instruct:free"
                                className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-cyan-500/60"
                              />
                              <button
                                type="button"
                                onClick={() => setOpenRouterModelDraft((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                                className="rounded-md border border-slate-700 px-2 py-2 text-xs text-slate-200 transition hover:border-rose-500/60"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenRouterModelDraft((prev) => [...prev, ''])}
                            className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                          >
                            Add Model
                          </button>
                          <button
                            type="button"
                            onClick={() => updateProviderModels('openrouter', Array.from(new Set(openRouterModelDraft.map((m) => m.trim()).filter(Boolean))))}
                            disabled={openRouterModelDraft.map((m) => m.trim()).filter(Boolean).length === 0}
                            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save Models
                          </button>
                          <button
                            type="button"
                            onClick={() => requestProviderModels('openrouter')}
                            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-500/50"
                          >
                            Refresh Models
                          </button>
                        </div>
                        <div className="text-xs text-slate-400">
                          Active models: {providerModels.openrouter.count}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={requestRealtimeSnapshot}
                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Request Realtime Sync
                </button>
              </div>
            ),
          }]}
        />
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="min-h-0 flex-1">
          <ChatWindow
            messages={messages}
            thinking={thinking}
            reasoningSteps={reasoningSteps}
            activeAgent={activeAgent}
            streamChunk={streamChunk}
            friendlyMessage={friendlyMessage}
          />
        </div>
        <ChatInput
          disabled={thinking}
          voiceEnabled={voiceEnabled}
          onVoiceEnabledChange={setVoiceEnabled}
          onSend={handleSendPrompt}
        />
      </div>
    );
  }, [
    section,
    agents,
    messages,
    thinking,
    reasoningSteps,
    activeAgent,
    streamChunk,
    friendlyMessage,
    sendPrompt,
    snapshot,
    memoryEntries,
    skillCards,
    sendSystemAction,
    requestRealtimeSnapshot,
    requestApiKeys,
    apiKeyDrafts,
    normalizedDrafts,
    updateApiKeys,
    apiKeysInfo,
    providerModels,
    requestProviderModels,
    updateProviderModels,
    openRouterModelDraft,
    recallQuery,
    recallLoading,
    recallError,
    recallResult,
    recallDebug,
    handleSendPrompt,
    voiceEnabled,
    voiceMuted,
    selectedVoice,
    voiceSample,
    voicePreview,
    toggleVoice,
    toggleMute,
    handleVoiceUpload,
    handleVoiceTrigger,
  ]);

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,0.16),transparent_40%),#020617] p-4 text-slate-100">
      {installPrompt ? (
        <div className="mb-2 flex justify-end text-xs text-slate-200">
          <button
            type="button"
            onClick={async () => {
              if (!installPrompt) return;
              await installPrompt.prompt();
              setInstallPrompt(null);
            }}
            className="rounded-full border border-cyan-500/60 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/20"
          >
            Install AI_OS_V3 (PWA)
          </button>
        </div>
      ) : null}
      <div className="grid h-[calc(100dvh-2rem)] grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-2">
          <Sidebar />
        </div>
        <div className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-7">
          <div className="min-h-0 flex-1">{centerContent}</div>
          <div className="max-h-[45vh] overflow-auto">
            <AccordionGroup
              items={[{
                id: 'system_logs',
                title: 'System Logs',
                subtitle: `${mergedLogs.length} entries`,
                content: <div className="h-40 lg:h-52"><LogConsole logs={mergedLogs} /></div>,
              }]}
            />
          </div>
        </div>
        <div className="col-span-12 min-h-0 lg:col-span-3">
          {rightPanel}
        </div>
      </div>
    </main>
  );
}
