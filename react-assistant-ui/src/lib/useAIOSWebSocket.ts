'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type AgentStatus = 'running' | 'idle' | 'completed';

export type AgentState = {
  id: string;
  name: string;
  status: AgentStatus;
  progress: number;
  executionTimeMs: number;
};

export type LogEntry = {
  id: string;
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

export type KeyProvider = 'groq' | 'openrouter' | 'gemini' | 'tavily';

type PendingRequest = {
  resolve: (v: { response: string; steps: string[]; agent: string }) => void;
  reject: (e: Error) => void;
  startedAt: number;
};

function nowIso() {
  return new Date().toISOString();
}

function mkLog(message: string, level: LogEntry['level'] = 'info'): LogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: nowIso(),
    level,
    message,
  };
}

export function useAIOSWebSocket() {
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reasoningSteps, setReasoningSteps] = useState<string[]>([]);
  const [activeAgent, setActiveAgent] = useState('');
  const [streamChunk, setStreamChunk] = useState('');
  const [thinking, setThinking] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [memoryProfile, setMemoryProfile] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<{ cpu: number; memory: number; activeTasks: number; health: 'healthy' | 'degraded' | 'critical' } | null>(null);
  const [apiKeysInfo, setApiKeysInfo] = useState<Record<KeyProvider, { count: number; masked: string[] }>>({
    groq: { count: 0, masked: [] },
    openrouter: { count: 0, masked: [] },
    gemini: { count: 0, masked: [] },
    tavily: { count: 0, masked: [] },
  });
  const [providerModels, setProviderModels] = useState<Record<'openrouter', { count: number; models: string[] }>>({
    openrouter: { count: 0, models: [] },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const activeAgentRef = useRef('');

  const wsUrl = useMemo(() => process.env.NEXT_PUBLIC_AIOS_WS_URL || 'ws://localhost:8000/ws/ai-os-v3', []);
  const apiBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000', []);

  const pushLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 250));
  }, []);

  const sendFrame = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    ws.send(JSON.stringify(payload));
  }, []);

  const requestRealtimeSnapshot = useCallback(() => {
    try {
      sendFrame({ type: 'state_sync_request', topics: ['snapshot', 'skills', 'memory', 'audit', 'health', 'agents'] });
    } catch (err) {
      pushLog(mkLog(`State sync request failed: ${String(err)}`, 'warn'));
    }
  }, [pushLog, sendFrame]);

  useEffect(() => {
    activeAgentRef.current = activeAgent;
  }, [activeAgent]);

  useEffect(() => {
    let cancelled = false;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        pushLog(mkLog('WebSocket connected'));
        requestRealtimeSnapshot();
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(String(ev.data || '{}')) as Record<string, any>;
          const type = String(payload.type || '');
          const requestId = String(payload.request_id || '');

          if (type === 'agent_update' && Array.isArray(payload.agents)) {
            setAgents(payload.agents as AgentState[]);
            return;
          }

          if (type === 'snapshot' && payload.data) {
            setSnapshot(payload.data);
            return;
          }

          if (type === 'skills' && Array.isArray(payload.data)) {
            setSkills(payload.data);
            return;
          }

          if (type === 'memory_profile' && payload.data) {
            setMemoryProfile(payload.data);
            return;
          }

          if (type === 'audit_logs' && Array.isArray(payload.data)) {
            setAuditLogs(payload.data);
            return;
          }

          if (type === 'health' && payload.data) {
            setHealth(payload.data);
            return;
          }

          if (type === 'system_metrics' && payload.metrics) {
            setMetrics(payload.metrics as { cpu: number; memory: number; activeTasks: number; health: 'healthy' | 'degraded' | 'critical' });
            return;
          }

          if ((type === 'api_keys' || type === 'api_keys_updated') && payload.provider) {
            const provider = String(payload.provider || 'groq') as KeyProvider;
            if (provider === 'groq' || provider === 'openrouter' || provider === 'gemini' || provider === 'tavily') {
              setApiKeysInfo((prev) => ({
                ...prev,
                [provider]: {
                  count: Number(payload.count || 0),
                  masked: Array.isArray(payload.masked) ? payload.masked.map(String) : [],
                },
              }));
            }
            return;
          }

          if (type === 'api_keys_error') {
            pushLog(mkLog(`API keys update failed: ${String(payload.error || 'unknown error')}`, 'error'));
            return;
          }

          if ((type === 'provider_models' || type === 'provider_models_updated') && payload.provider === 'openrouter') {
            setProviderModels({
              openrouter: {
                count: Number(payload.count || 0),
                models: Array.isArray(payload.models) ? payload.models.map(String) : [],
              },
            });
            return;
          }

          if (type === 'provider_models_error') {
            pushLog(mkLog(`Provider model update failed: ${String(payload.error || 'unknown error')}`, 'error'));
            return;
          }

          if (type === 'reasoning_step' && payload.step) {
            setReasoningSteps((prev) => [String(payload.step), ...prev].slice(0, 14));
            return;
          }

          if (type === 'active_agent' && payload.agent) {
            setActiveAgent(String(payload.agent));
            return;
          }

          if (type === 'stream_chunk' && typeof payload.chunk === 'string') {
            setStreamChunk((prev) => `${prev}${payload.chunk}`);
            return;
          }

          if (type === 'log' && payload.message) {
            pushLog(mkLog(String(payload.message), payload.level || 'info'));
            return;
          }

          if (type === 'chat_final' && requestId) {
            const pending = pendingRef.current.get(requestId);
            if (pending) {
              pendingRef.current.delete(requestId);
              setThinking(false);
              pending.resolve({
                response: String(payload.response || ''),
                steps: Array.isArray(payload.steps) ? payload.steps.map(String) : [],
                agent: String(payload.agent || activeAgentRef.current || 'unknown'),
              });
            }
            return;
          }

          if (type === 'chat_error' && requestId) {
            const pending = pendingRef.current.get(requestId);
            if (pending) {
              pendingRef.current.delete(requestId);
              setThinking(false);
              pending.reject(new Error(String(payload.error || 'chat_error')));
            }
            return;
          }
        } catch {
          // ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setThinking(false);
        for (const [, p] of pendingRef.current.entries()) {
          p.reject(new Error('WebSocket closed'));
        }
        pendingRef.current.clear();
        pushLog(mkLog('WebSocket disconnected', 'warn'));
      };

      ws.onerror = () => {
        if (cancelled) return;
        pushLog(mkLog('WebSocket error', 'error'));
      };
    } catch (err) {
      pushLog(mkLog(`WebSocket init failed: ${String(err)}`, 'error'));
      setConnected(false);
    }

    return () => {
      cancelled = true;
      for (const [, p] of pendingRef.current.entries()) {
        p.reject(new Error('WebSocket cleanup'));
      }
      pendingRef.current.clear();
      if (wsRef.current) wsRef.current.close();
    };
  }, [pushLog, requestRealtimeSnapshot, wsUrl]);

  const sendPrompt = useCallback(async (prompt: string): Promise<{ response: string; steps: string[]; agent: string }> => {
    if (!connected) {
      throw new Error('WebSocket not connected');
    }

    setThinking(true);
    setReasoningSteps([]);
    setStreamChunk('');

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const promise = new Promise<{ response: string; steps: string[]; agent: string }>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject, startedAt: Date.now() });
    });

    try {
      sendFrame({
        type: 'chat_prompt',
        request_id: requestId,
        prompt,
      });
      pushLog(mkLog(`Prompt sent via websocket: ${prompt.slice(0, 90)}`));
    } catch (err) {
      pendingRef.current.delete(requestId);
      setThinking(false);
      throw err instanceof Error ? err : new Error(String(err));
    }

    return promise;
  }, [connected, pushLog, sendFrame]);

  const sendSystemAction = useCallback((action: 'start' | 'stop' | 'restart' | 'clear_memory' | 'refresh_knowledge') => {
    sendFrame({ type: 'system_action', action });
    pushLog(mkLog(`System action sent: ${action}`));
  }, [pushLog, sendFrame]);

  const requestApiKeys = useCallback((provider: KeyProvider) => {
    try {
      sendFrame({ type: 'api_keys_request', provider });
    } catch (err) {
      pushLog(mkLog(`API key request failed: ${String(err)}`, 'warn'));
    }
  }, [pushLog, sendFrame]);

  const updateApiKeys = useCallback((provider: KeyProvider, keys: string[]) => {
    try {
      sendFrame({ type: 'api_keys_update', provider, keys });
      pushLog(mkLog(`API key update requested (${provider}, ${keys.length} keys)`));
    } catch (err) {
      pushLog(mkLog(`API key update failed: ${String(err)}`, 'error'));
    }
  }, [pushLog, sendFrame]);

  const requestProviderModels = useCallback((provider: 'openrouter') => {
    try {
      sendFrame({ type: 'provider_models_request', provider });
    } catch (err) {
      pushLog(mkLog(`Provider model request failed: ${String(err)}`, 'warn'));
    }
  }, [pushLog, sendFrame]);

  const updateProviderModels = useCallback((provider: 'openrouter', models: string[]) => {
    try {
      sendFrame({ type: 'provider_models_update', provider, models });
      pushLog(mkLog(`Provider models update requested (${provider}, ${models.length} models)`));
    } catch (err) {
      pushLog(mkLog(`Provider models update failed: ${String(err)}`, 'error'));
    }
  }, [pushLog, sendFrame]);

  const recallDebug = useCallback(async (message: string): Promise<{
    injected_memory_facts: string[];
    memory_sources: Array<{ namespace: string; key: string; score: number }>;
    extracted_personal_facts_preview: Array<{ key: string; value: string }>;
    total_injected: number;
  }> => {
    const msg = String(message || '').trim();
    if (!msg) throw new Error('message is required');
    const res = await fetch(`${apiBaseUrl}/memory/recall-debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json() as { detail?: string };
        if (j?.detail) detail = j.detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return await res.json() as {
      injected_memory_facts: string[];
      memory_sources: Array<{ namespace: string; key: string; score: number }>;
      extracted_personal_facts_preview: Array<{ key: string; value: string }>;
      total_injected: number;
    };
  }, [apiBaseUrl]);

  return {
    connected,
    agents,
    logs,
    reasoningSteps,
    activeAgent,
    streamChunk,
    thinking,
    snapshot,
    skills,
    memoryProfile,
    auditLogs,
    health,
    metrics,
    apiKeysInfo,
    providerModels,
    sendPrompt,
    sendSystemAction,
    requestRealtimeSnapshot,
    requestApiKeys,
    updateApiKeys,
    requestProviderModels,
    updateProviderModels,
    recallDebug,
  };
}
