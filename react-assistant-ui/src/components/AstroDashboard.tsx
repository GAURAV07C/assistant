import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiBase } from '../lib/apiBase.js';
import { trimText } from '../lib/utils.js';
import { TTSPlayer } from '../lib/ttsPlayer.js';
import { actionNodes, SYSTEM_FEATURE_MATRIX, TEXT_SYNC_TTS } from '../lib/constants.js';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardShell } from './dashboard/DashboardShell';
import { OverviewTab } from './dashboard/tabs/OverviewTab';
import { ChatTab } from './dashboard/tabs/ChatTab';
import { AgentTab } from './dashboard/tabs/AgentTab';
import { SkillsTab } from './dashboard/tabs/SkillsTab';
import { FilesTab } from './dashboard/tabs/FilesTab';
import { VoiceTab } from './dashboard/tabs/VoiceTab';
import { LogsTab } from './dashboard/tabs/LogsTab';

const API = resolveApiBase();

function AstroDashboard() {
  const [mode, setMode] = useState('general');
  const [agentMode, setAgentMode] = useState('strategic');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [health, setHealth] = useState('CHECKING');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [searchPayload, setSearchPayload] = useState(null);
  const [memoryProfile, setMemoryProfile] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'chat' | 'agent' | 'skills' | 'files' | 'voice' | 'logs'
  >('overview');
  const [statusLine, setStatusLine] = useState('ASTRO_ONLINE');
  const [selectedLearningFile, setSelectedLearningFile] = useState('');
  const [learningFileContent, setLearningFileContent] = useState('');
  const [learningFileMeta, setLearningFileMeta] = useState(null);
  const [loadingLearningFile, setLoadingLearningFile] = useState(false);
  const [savingLearningFile, setSavingLearningFile] = useState(false);
  const [newLearningFileName, setNewLearningFileName] = useState('');
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [workspacePathInput, setWorkspacePathInput] = useState('');
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState('');
  const [workspaceFileContent, setWorkspaceFileContent] = useState('');
  const [workspaceFileMeta, setWorkspaceFileMeta] = useState(null);
  const [loadingWorkspaceFile, setLoadingWorkspaceFile] = useState(false);
  const [savingWorkspaceFile, setSavingWorkspaceFile] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState(null);
  const [voiceMode, setVoiceMode] = useState('edge');
  const [voiceEdge, setVoiceEdge] = useState('');
  const [voiceCustomId, setVoiceCustomId] = useState('');
  const [voiceRate, setVoiceRate] = useState('+22%');
  const [voiceUploadName, setVoiceUploadName] = useState('');
  const [voiceUploadEdge, setVoiceUploadEdge] = useState('en-IN-NeerjaNeural');
  const [voiceUploadRate, setVoiceUploadRate] = useState('+22%');
  const [voiceUploadFile, setVoiceUploadFile] = useState(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [voiceLoopEnabled, setVoiceLoopEnabled] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [agentPanelData, setAgentPanelData] = useState(null);
  const [agentPanelSource, setAgentPanelSource] = useState('');
  const [evolutionStatus, setEvolutionStatus] = useState(null);
  const [curriculumNext, setCurriculumNext] = useState(null);
  const [reflectionRecent, setReflectionRecent] = useState([]);
  const [routerStats, setRouterStats] = useState(null);
  const [skillsList, setSkillsList] = useState([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillDetail, setSkillDetail] = useState(null);
  const [skillTaskInput, setSkillTaskInput] = useState('');
  const [skillRunInput, setSkillRunInput] = useState('');
  const [skillsBusy, setSkillsBusy] = useState(false);

  const ttsRef = useRef(new TTSPlayer());
  const transcriptRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechRestartRef = useRef(null);

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
    void fetchVoiceSettings();
    void fetchEvolutionData();
  }, []);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) setMicSupported(false);
    return () => {
      stopListeningInternal(true);
    };
  }, []);

  useEffect(() => {
    if (!voiceLoopEnabled) return;
    if (streaming || micListening) return;
    scheduleVoiceLoopListen(700);
    return () => clearSpeechRestart();
  }, [voiceLoopEnabled, streaming, micListening]);

  useEffect(() => {
    if (activeTab === 'overview') {
      void fetchEvolutionData();
      void fetchMemory();
      void fetchAudit();
      return;
    }
    if (activeTab === 'skills') {
      void fetchSkillsList();
      return;
    }
    if (activeTab === 'files') {
      void fetchMemory();
      return;
    }
    if (activeTab === 'voice') {
      void fetchVoiceSettings();
      return;
    }
    if (activeTab === 'logs') {
      void fetchAudit();
      void fetchMemory();
    }
  }, [activeTab]);

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

  async function fetchVoiceSettings() {
    try {
      const res = await fetch(`${API}/voice/settings`);
      if (!res.ok) throw new Error('voice settings failed');
      const data = await res.json();
      setVoiceSettings(data);
      setVoiceMode(data.active_source || 'edge');
      setVoiceEdge(data.edge_voice || '');
      setVoiceCustomId(data.active_voice_id || '');
      setVoiceRate(data.rate || '+22%');
    } catch {
      setVoiceSettings(null);
    }
  }

  async function fetchEvolutionData() {
    try {
      const [evoRes, curRes, refRes, routerRes] = await Promise.all([
        fetch(`${API}/evolution/status`),
        fetch(`${API}/curriculum/next`),
        fetch(`${API}/reflection/recent?limit=20`),
        fetch(`${API}/router/stats`),
      ]);

      const evo = evoRes.ok ? await evoRes.json() : null;
      const cur = curRes.ok ? await curRes.json() : null;
      const ref = refRes.ok ? await refRes.json() : null;
      const router = routerRes.ok ? await routerRes.json() : null;

      setEvolutionStatus(evo);
      setCurriculumNext(cur);
      setReflectionRecent(Array.isArray(ref?.reviews) ? ref.reviews : []);
      setRouterStats(router);
    } catch {
      setEvolutionStatus(null);
      setCurriculumNext(null);
      setReflectionRecent([]);
      setRouterStats(null);
    }
  }

  async function saveVoiceSettings() {
    setVoiceBusy(true);
    try {
      const payload = {
        active_source: voiceMode,
        active_voice_id: voiceMode === 'custom' ? voiceCustomId : voiceEdge,
        edge_voice: voiceEdge,
        rate: voiceRate,
      };
      const res = await fetch(`${API}/voice/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('voice settings save failed');
      await fetchVoiceSettings();
      setStatusLine('ASTRO_VOICE_UPDATED');
    } catch {
      setStatusLine('ASTRO_VOICE_UPDATE_FAILED');
    } finally {
      setVoiceBusy(false);
    }
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('file read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadCustomVoice() {
    const name = String(voiceUploadName || '').trim();
    if (!name) {
      setStatusLine('ASTRO_CUSTOM_VOICE_NAME_REQUIRED');
      return;
    }

    setVoiceBusy(true);
    try {
      let sample_base64;
      let sample_mime;
      if (voiceUploadFile) {
        sample_base64 = await fileToBase64(voiceUploadFile);
        sample_mime = voiceUploadFile.type || 'audio/mpeg';
      }

      const res = await fetch(`${API}/voice/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          edge_voice: voiceUploadEdge,
          rate: voiceUploadRate,
          sample_base64,
          sample_mime,
        }),
      });
      if (!res.ok) throw new Error('custom voice upload failed');

      setVoiceUploadName('');
      setVoiceUploadFile(null);
      await fetchVoiceSettings();
      setStatusLine('ASTRO_CUSTOM_VOICE_SAVED');
    } catch {
      setStatusLine('ASTRO_CUSTOM_VOICE_SAVE_FAILED');
    } finally {
      setVoiceBusy(false);
    }
  }

  async function fetchLearningFile(name) {
    if (!name) return;
    setLoadingLearningFile(true);
    try {
      const res = await fetch(`${API}/learning/file?name=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error('learning file load failed');
      const data = await res.json();
      setSelectedLearningFile(data.name || name);
      setLearningFileContent(String(data.content || ''));
      setLearningFileMeta({ bytes: data.bytes, updated_at: data.updated_at });
      setStatusLine('ASTRO_FILE_LOADED');
    } catch {
      setStatusLine('ASTRO_FILE_LOAD_FAILED');
    } finally {
      setLoadingLearningFile(false);
    }
  }

  async function saveLearningFile() {
    if (!selectedLearningFile) return;
    setSavingLearningFile(true);
    try {
      const res = await fetch(`${API}/learning/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedLearningFile,
          content: learningFileContent,
        }),
      });
      if (!res.ok) throw new Error('learning file save failed');
      const data = await res.json();
      setLearningFileMeta({ bytes: data.bytes, updated_at: data.updated_at });
      setStatusLine('ASTRO_FILE_SAVED');
      await fetchMemory();
    } catch {
      setStatusLine('ASTRO_FILE_SAVE_FAILED');
    } finally {
      setSavingLearningFile(false);
    }
  }
  function normalizeLearningFileName(input) {
    const raw = String(input || '').trim().replace(/\s+/g, '_');
    if (!raw) return '';
    const name = raw.endsWith('.txt') ? raw : `${raw}.txt`;
    return /^[a-zA-Z0-9_.-]+\.txt$/.test(name) ? name : '';
  }

  async function createOrOpenLearningFile() {
    const fileName = normalizeLearningFileName(newLearningFileName);
    if (!fileName) {
      setStatusLine('ASTRO_INVALID_FILE_NAME');
      return;
    }

    setSelectedLearningFile(fileName);
    setSavingLearningFile(true);
    try {
      const res = await fetch(`${API}/learning/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fileName,
          content: learningFileContent || '',
        }),
      });
      if (!res.ok) throw new Error('learning file create failed');

      setNewLearningFileName('');
      setStatusLine('ASTRO_FILE_CREATED');
      await fetchMemory();
      await fetchLearningFile(fileName);
    } catch {
      setStatusLine('ASTRO_FILE_CREATE_FAILED');
    } finally {
      setSavingLearningFile(false);
    }
  }

  async function fetchWorkspaceFiles(dir = '') {
    try {
      const res = await fetch(`${API}/workspace/files?dir=${encodeURIComponent(dir)}&limit=700`);
      if (!res.ok) throw new Error('workspace files list failed');
      const data = await res.json();
      setWorkspaceFiles(Array.isArray(data.files) ? data.files : []);
      if (!selectedWorkspaceFile && Array.isArray(data.files) && data.files.length > 0) {
        void fetchWorkspaceFile(data.files[0]);
      }
      setStatusLine('ASTRO_WORKSPACE_FILES_READY');
    } catch {
      setWorkspaceFiles([]);
      setStatusLine('ASTRO_WORKSPACE_FILES_FAILED');
    }
  }

  async function fetchWorkspaceFile(filePath) {
    if (!filePath) return;
    setLoadingWorkspaceFile(true);
    try {
      const res = await fetch(`${API}/workspace/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('workspace file load failed');
      const data = await res.json();
      setSelectedWorkspaceFile(data.path || filePath);
      setWorkspacePathInput(data.path || filePath);
      setWorkspaceFileContent(String(data.content || ''));
      setWorkspaceFileMeta({ bytes: data.bytes, updated_at: data.updated_at });
      setStatusLine('ASTRO_WORKSPACE_FILE_LOADED');
    } catch {
      setStatusLine('ASTRO_WORKSPACE_FILE_LOAD_FAILED');
    } finally {
      setLoadingWorkspaceFile(false);
    }
  }

  async function saveWorkspaceFile() {
    const pathValue = String(workspacePathInput || selectedWorkspaceFile || '').trim();
    if (!pathValue) return;
    setSavingWorkspaceFile(true);
    try {
      const res = await fetch(`${API}/workspace/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathValue,
          content: workspaceFileContent,
        }),
      });
      if (!res.ok) throw new Error('workspace file save failed');
      const data = await res.json();
      setSelectedWorkspaceFile(pathValue);
      setWorkspaceFileMeta({ bytes: data.bytes, updated_at: data.updated_at });
      setStatusLine('ASTRO_WORKSPACE_FILE_SAVED');
      await fetchWorkspaceFiles();
    } catch {
      setStatusLine('ASTRO_WORKSPACE_FILE_SAVE_FAILED');
    } finally {
      setSavingWorkspaceFile(false);
    }
  }

  async function fetchSkillsList() {
    try {
      const res = await fetch(`${API}/skills/list`);
      if (!res.ok) throw new Error('skills list load failed');
      const data = await res.json();
      const list = Array.isArray(data.skills) ? data.skills : [];
      setSkillsList(list);
      if (!selectedSkillId && list.length > 0) {
        void fetchSkillDetail(list[0].id);
      }
      setStatusLine('ASTRO_SKILLS_READY');
    } catch {
      setSkillsList([]);
      setStatusLine('ASTRO_SKILLS_FAILED');
    }
  }

  async function fetchSkillDetail(skillId) {
    if (!skillId) return;
    try {
      const res = await fetch(`${API}/skills/detail/${encodeURIComponent(skillId)}`);
      if (!res.ok) throw new Error('skill detail load failed');
      const data = await res.json();
      setSelectedSkillId(skillId);
      setSkillDetail(data);
      setStatusLine('ASTRO_SKILL_DETAIL_READY');
    } catch {
      setStatusLine('ASTRO_SKILL_DETAIL_FAILED');
    }
  }

  async function toggleSkill(skillId, enabled) {
    if (!skillId) return;
    setSkillsBusy(true);
    try {
      const res = await fetch(`${API}/skills/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skillId, enabled }),
      });
      if (!res.ok) throw new Error('skill toggle failed');
      await fetchSkillsList();
      await fetchSkillDetail(skillId);
      setStatusLine('ASTRO_SKILL_UPDATED');
    } catch {
      setStatusLine('ASTRO_SKILL_UPDATE_FAILED');
    } finally {
      setSkillsBusy(false);
    }
  }

  async function triggerSkillLearn() {
    const task = String(skillTaskInput || '').trim();
    if (!task) return;
    setSkillsBusy(true);
    try {
      const res = await fetch(`${API}/skills/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          conversation: messages.slice(-6).map((m) => `${m.role}:${m.text}`).join('\n'),
        }),
      });
      if (!res.ok) throw new Error('skill learn failed');
      const data = await res.json();
      await fetchSkillsList();
      if (Array.isArray(data.detected) && data.detected.length > 0) {
        await fetchSkillDetail(data.detected[0]);
      }
      setStatusLine('ASTRO_SKILL_LEARNED');
    } catch {
      setStatusLine('ASTRO_SKILL_LEARN_FAILED');
    } finally {
      setSkillsBusy(false);
    }
  }

  async function triggerSkillEvolve(result) {
    if (!selectedSkillId) return;
    setSkillsBusy(true);
    try {
      const res = await fetch(`${API}/skills/evolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: selectedSkillId,
          result,
          notes: `manual_evolution_from_ui:${result}`,
        }),
      });
      if (!res.ok) throw new Error('skill evolve failed');
      await fetchSkillsList();
      await fetchSkillDetail(selectedSkillId);
      setStatusLine('ASTRO_SKILL_EVOLVED');
    } catch {
      setStatusLine('ASTRO_SKILL_EVOLVE_FAILED');
    } finally {
      setSkillsBusy(false);
    }
  }

  async function executeSkillTest() {
    if (!selectedSkillId || !String(skillRunInput || '').trim()) return;
    setSkillsBusy(true);
    try {
      const res = await fetch(`${API}/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: selectedSkillId,
          message: skillRunInput,
        }),
      });
      if (!res.ok) throw new Error('skill execute failed');
      const data = await res.json();
      setSkillDetail((prev) => ({ ...prev, last_run: data.result }));
      setStatusLine('ASTRO_SKILL_EXECUTED');
    } catch {
      setStatusLine('ASTRO_SKILL_EXECUTE_FAILED');
    } finally {
      setSkillsBusy(false);
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

  async function handleNodeAction(action) {
    if (action === 'dashboard') {
      setActiveTab('overview');
      void fetchEvolutionData();
      void fetchMemory();
      void fetchAudit();
      setStatusLine('ASTRO_OVERVIEW_READY');
      return;
    }
    if (action === 'skills') {
      setActiveTab('skills');
      void fetchSkillsList();
      setStatusLine('ASTRO_SKILLS_READY');
      return;
    }
    if (action === 'files') {
      setActiveTab('files');
      void fetchMemory();
      setStatusLine('ASTRO_FILES_READY');
      return;
    }
    if (action === 'memory') {
      setActiveTab('logs');
      void fetchMemory();
      setStatusLine('ASTRO_MEMORY_READY');
      return;
    }
    if (action === 'audit') {
      setActiveTab('logs');
      void fetchAudit();
      setStatusLine('ASTRO_AUDIT_READY');
      return;
    }
    if (action === 'profile') {
      await upsertProfileTouch();
      setActiveTab('voice');
      void fetchVoiceSettings();
      setStatusLine('ASTRO_VOICE_READY');
      return;
    }
  }


  function clearSpeechRestart() {
    if (!speechRestartRef.current) return;
    clearTimeout(speechRestartRef.current);
    speechRestartRef.current = null;
  }

  function getSpeechRecognitionCtor() {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  function stopListeningInternal(disableLoop = false) {
    clearSpeechRestart();
    if (disableLoop) setVoiceLoopEnabled(false);
    const rec = recognitionRef.current;
    if (!rec) {
      setMicListening(false);
      return;
    }
    try {
      rec.stop();
    } catch {
      // ignore
    }
    setMicListening(false);
  }

  function startListening(options = { autoSend: false }) {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicSupported(false);
      setStatusLine('ASTRO_MIC_NOT_SUPPORTED');
      return;
    }

    clearSpeechRestart();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let finalText = '';

    rec.onresult = (event) => {
      let draft = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = String(event.results[i][0]?.transcript || '');
        if (event.results[i].isFinal) finalText += `${text} `;
        else draft += text;
      }
      const merged = `${finalText}${draft}`.trim();
      if (merged) setInput(merged);
    };

    rec.onerror = () => {
      setStatusLine('ASTRO_MIC_ERROR');
    };

    rec.onend = () => {
      setMicListening(false);
      const spoken = finalText.trim();
      if (spoken) {
        setInput(spoken);
        if (options.autoSend && !streaming) {
          void sendMessage(spoken);
        }
      }

      if (voiceLoopEnabled) {
        scheduleVoiceLoopListen(900);
      }
    };

    try {
      rec.start();
      setMicListening(true);
      setStatusLine(options.autoSend ? 'ASTRO_VOICE_LISTENING' : 'ASTRO_MIC_LISTENING');
    } catch {
      setMicListening(false);
      setStatusLine('ASTRO_MIC_START_FAILED');
    }
  }

  function isAssistantAudioActive() {
    return ttsEnabled && !!ttsRef.current?.isBusy?.();
  }

  function scheduleVoiceLoopListen(delay = 700) {
    clearSpeechRestart();
    speechRestartRef.current = setTimeout(() => {
      if (!voiceLoopEnabled || streaming || micListening) return;
      if (isAssistantAudioActive()) {
        scheduleVoiceLoopListen(600);
        return;
      }
      startListening({ autoSend: true });
    }, delay);
  }

  function toggleVoiceLoopFromStandby() {
    if (voiceLoopEnabled || micListening) {
      stopListeningInternal(true);
      setStatusLine('ASTRO_VOICE_LOOP_STOPPED');
      return;
    }
    setVoiceLoopEnabled(true);
    startListening({ autoSend: true });
  }

  function toggleComposerMic() {
    if (micListening) {
      stopListeningInternal(false);
      setStatusLine('ASTRO_MIC_STOPPED');
      return;
    }
    startListening({ autoSend: false });
  }

  function toggleMute() {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    if (!next) {
      ttsRef.current.stop();
      setStatusLine('ASTRO_MUTED');
    } else {
      setStatusLine('ASTRO_UNMUTED');
    }
  }

  function setModeWithStatus(nextMode) {
    setMode(nextMode);
    setStatusLine(nextMode === 'realtime' ? 'ASTRO_REALTIME_MODE' : 'ASTRO_GENERAL_MODE');
  }

  function setAgentModeWithStatus(nextMode) {
    const value = nextMode === 'casual' ? 'casual' : 'strategic';
    setAgentMode(value);
    setStatusLine(value === 'casual' ? 'ASTRO_AGENT_CASUAL' : 'ASTRO_AGENT_STRATEGIC');
  }

  function withAgentModeHint(text) {
    const clean = String(text || '').trim();
    if (!clean) return clean;
    return agentMode === 'casual'
      ? 'Switch to casual mode\n' + clean
      : 'Switch to strategic mode\n' + clean;
  }

  function formatJsonCompact(value) {
    if (!value) return 'No data';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function openAgentPanelWith(payload, source) {
    setAgentPanelData(payload || null);
    setAgentPanelSource(source || '');
    setAgentPanelOpen(true);
  }

  function summarizeAgentPayload(payload, source) {
    if (!payload) return 'No agent payload yet.';
    if (payload.clarification_question) return 'Clarification required (' + source + ')';
    if (payload.result) return trimText(payload.result, 180);
    if (payload.plan?.goal) return 'Goal: ' + payload.plan.goal;
    if (payload.status) return 'Status: ' + payload.status;
    return 'Agent response received (' + source + ')';
  }

  async function runAgentPlan(instructionText) {
    const instruction = String(instructionText || '').trim();
    if (!instruction || streaming) return;

    setStatusLine('ASTRO_AGENT_PLANNING');
    try {
      const res = await fetch(API + '/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          forced_mode: agentMode,
          context: { source: 'react_assistant_ui', route_mode: mode },
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || 'HTTP ' + res.status);
      }

      const data = await res.json();
      openAgentPanelWith(data, 'plan');
      await fetchEvolutionData();
      setStatusLine(data.status === 'clarification_required' ? 'ASTRO_AGENT_CLARIFY' : 'ASTRO_AGENT_PLAN_READY');
    } catch {
      setStatusLine('ASTRO_AGENT_PLAN_FAILED');
    }
  }

  async function runAgentExecute(instructionText) {
    const instruction = String(instructionText || '').trim();
    if (!instruction || streaming) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: instruction }, { role: 'assistant', text: '' }]);
    setStreaming(true);
    setStatusLine('ASTRO_AGENT_EXECUTING');

    try {
      const payload = {
        instruction,
        forced_mode: agentMode,
        session_id: null,
        confirm: false,
        context: { source: 'react_assistant_ui', route_mode: mode },
      };

      let res = await fetch(`${API}/agent/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        const ok = window.confirm(body?.detail || 'Action requires confirmation. Continue?');
        if (ok) {
          payload.confirm = true;
          res = await fetch(`${API}/agent/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      }

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      const text = data.result || data.clarification_question || 'Agent task completed.';
      openAgentPanelWith(data, 'execute');
      await fetchEvolutionData();

      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0 && next[idx].role === 'assistant') {
          next[idx] = { ...next[idx], text };
        }
        return next;
      });

      setStatusLine(data.status === 'clarification_required' ? 'ASTRO_AGENT_CLARIFY' : 'ASTRO_AGENT_DONE');
    } catch (err) {
      const msg = `Something went wrong: ${err.message || String(err)}`;
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0 && next[idx].role === 'assistant') {
          next[idx] = { ...next[idx], text: msg };
        }
        return next;
      });
      setStatusLine('ASTRO_ERROR');
    } finally {
      setStreaming(false);
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
      const agentAwareMessage = withAgentModeHint(text);
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: agentAwareMessage, session_id: null, shared_session: true, tts: ttsEnabled }),
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
              if (typeof tts.speakFallbackProgress === 'function') {
                usedFallbackStreaming = tts.speakFallbackProgress() || usedFallbackStreaming;
              }
            }
          }

          if (data.audio && ttsEnabled && !TEXT_SYNC_TTS) {
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

      await fetchEvolutionData();
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
    return messages.map((m, idx) => ({
      role: m.role === 'assistant' ? 'ASTRO_RESPONSE' : 'USER_CMD',
      text: m.text,
      key: `msg-${idx}`,
    }));
  }, [messages]);

  const panelPlan = agentPanelData?.plan || null;
  const panelContract = agentPanelData?.internal_contract || null;
  const panelEvaluation = agentPanelData?.evaluation || null;
  const panelSteps = Array.isArray(panelPlan?.steps)
    ? panelPlan.steps
    : Array.isArray(agentPanelData?.execution_trace)
      ? agentPanelData.execution_trace
      : [];

  const selectedSkillEnabled =
    skillsList.find((s) => s.id === selectedSkillId)?.enabled ?? false;

  const panelStepsText = panelSteps.length
    ? panelSteps
        .map((step, idx) =>
          String(idx + 1) + '. ' + (typeof step === 'string' ? step : JSON.stringify(step)),
        )
        .join('\n')
    : 'No steps generated yet.';

  return (
    <DashboardShell>
      <DashboardHeader
        apiBase={API}
        sessionId={sessionId}
        health={health}
        mode={mode}
        agentMode={agentMode}
        ttsEnabled={ttsEnabled}
        onToggleTts={toggleMute}
        onRefresh={() => {
          void fetchMemory();
          void fetchAudit();
          void fetchEvolutionData();
        }}
        onNewChat={newChat}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="agent">Agent</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="voice">Voice</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={mode === 'general' ? 'default' : 'secondary'}
                type="button"
                onClick={() => setModeWithStatus('general')}
              >
                General
              </Button>
              <Button
                variant={mode === 'realtime' ? 'default' : 'secondary'}
                type="button"
                onClick={() => setModeWithStatus('realtime')}
              >
                Realtime
              </Button>
              <Separator orientation="vertical" className="hidden h-8 md:block" />
              <Button
                variant={agentMode === 'casual' ? 'default' : 'secondary'}
                type="button"
                onClick={() => setAgentModeWithStatus('casual')}
              >
                Casual
              </Button>
              <Button
                variant={agentMode === 'strategic' ? 'default' : 'secondary'}
                type="button"
                onClick={() => setAgentModeWithStatus('strategic')}
              >
                Strategic
              </Button>
            </div>
          </div>

          <TabsContent value="overview">
            <OverviewTab
              memoryProfile={memoryProfile}
              auditLogs={auditLogs}
              ttsEnabled={ttsEnabled}
              actionNodes={actionNodes}
              onNodeAction={handleNodeAction}
              featureMatrix={SYSTEM_FEATURE_MATRIX}
              evolutionStatus={evolutionStatus}
              curriculumNext={curriculumNext}
              routerStats={routerStats}
              formatJsonCompact={formatJsonCompact}
            />
          </TabsContent>

          <TabsContent value="chat">
            <ChatTab
              transcriptRef={transcriptRef}
              hasMessages={hasMessages}
              rightItems={rightItems}
              streaming={streaming}
              input={input}
              onInputChange={setInput}
              onSend={sendMessage}
              onToggleMic={toggleComposerMic}
              micSupported={micSupported}
              micListening={micListening}
              onPlan={() => runAgentPlan(input)}
              onAgentRun={() => runAgentExecute(input)}
              mode={mode}
              statusLine={statusLine}
              onRefreshLogs={() => void fetchAudit()}
              onRefreshMemory={() => void fetchMemory()}
              onRefreshVoice={() => void fetchVoiceSettings()}
            />
          </TabsContent>

          <TabsContent value="agent">
            <AgentTab
              input={input}
              streaming={streaming}
              onPlan={() => runAgentPlan(input)}
              onExecute={() => runAgentExecute(input)}
              onToggleDetails={() => setAgentPanelOpen((v) => !v)}
              agentPanelData={agentPanelData}
              agentPanelSource={agentPanelSource}
              reflectionRecent={reflectionRecent}
              panelPlan={panelPlan}
              panelStepsText={panelStepsText}
              formatJsonCompact={formatJsonCompact}
            />
          </TabsContent>

          <TabsContent value="skills">
            <SkillsTab
              skillsBusy={skillsBusy}
              skillsList={skillsList}
              selectedSkillId={selectedSkillId}
              onSelectSkill={fetchSkillDetail}
              onRefresh={fetchSkillsList}
              onLearnFromTask={triggerSkillLearn}
              skillTaskInput={skillTaskInput}
              onSkillTaskInputChange={setSkillTaskInput}
              selectedSkillEnabled={selectedSkillEnabled}
              onToggleSelected={() => void toggleSkill(selectedSkillId, !selectedSkillEnabled)}
              onEvolveSuccess={() => void triggerSkillEvolve('success')}
              onEvolveFailure={() => void triggerSkillEvolve('failure')}
              skillRunInput={skillRunInput}
              onSkillRunInputChange={setSkillRunInput}
              onExecuteSkill={executeSkillTest}
              skillDetail={skillDetail}
              formatJsonCompact={formatJsonCompact}
            />
          </TabsContent>

          <TabsContent value="files">
            <FilesTab
              memoryProfile={memoryProfile}
              newLearningFileName={newLearningFileName}
              onNewLearningFileNameChange={setNewLearningFileName}
              onRefreshLearningFiles={fetchMemory}
              onCreateLearningFile={createOrOpenLearningFile}
              selectedLearningFile={selectedLearningFile}
              onSelectedLearningFileChange={setSelectedLearningFile}
              loadingLearningFile={loadingLearningFile}
              savingLearningFile={savingLearningFile}
              onLoadLearningFile={() => fetchLearningFile(selectedLearningFile)}
              onSaveLearningFile={saveLearningFile}
              learningFileContent={learningFileContent}
              onLearningFileContentChange={setLearningFileContent}
              learningFileMeta={learningFileMeta}
              workspacePathInput={workspacePathInput}
              onWorkspacePathInputChange={setWorkspacePathInput}
              onListWorkspaceFiles={fetchWorkspaceFiles}
              selectedWorkspaceFile={selectedWorkspaceFile}
              onSelectedWorkspaceFileChange={setSelectedWorkspaceFile}
              loadingWorkspaceFile={loadingWorkspaceFile}
              savingWorkspaceFile={savingWorkspaceFile}
              onLoadWorkspaceFile={() => fetchWorkspaceFile(selectedWorkspaceFile)}
              onSaveWorkspaceFile={saveWorkspaceFile}
              workspaceFileContent={workspaceFileContent}
              onWorkspaceFileContentChange={setWorkspaceFileContent}
              workspaceFileMeta={workspaceFileMeta}
              workspaceFiles={workspaceFiles}
              onPickWorkspaceFile={(f) => {
                setSelectedWorkspaceFile(f);
                void fetchWorkspaceFile(f);
              }}
            />
          </TabsContent>

          <TabsContent value="voice">
            <VoiceTab
              voiceSettings={voiceSettings}
              voiceBusy={voiceBusy}
              onRefreshVoice={fetchVoiceSettings}
              onApplyVoice={saveVoiceSettings}
              onToggleVoiceLoop={toggleVoiceLoopFromStandby}
              micSupported={micSupported}
              voiceLoopEnabled={voiceLoopEnabled}
              micListening={micListening}
              voiceMode={voiceMode}
              onVoiceModeChange={setVoiceMode}
              voiceEdge={voiceEdge}
              onVoiceEdgeChange={setVoiceEdge}
              voiceCustomId={voiceCustomId}
              onVoiceCustomIdChange={setVoiceCustomId}
              voiceRate={voiceRate}
              onVoiceRateChange={setVoiceRate}
              voiceUploadName={voiceUploadName}
              onVoiceUploadNameChange={setVoiceUploadName}
              voiceUploadEdge={voiceUploadEdge}
              onVoiceUploadEdgeChange={setVoiceUploadEdge}
              voiceUploadRate={voiceUploadRate}
              onVoiceUploadRateChange={setVoiceUploadRate}
              onVoiceUploadFileChange={setVoiceUploadFile}
              onUploadCustomVoice={uploadCustomVoice}
              formatJsonCompact={formatJsonCompact}
              textSyncTtsEnabled={TEXT_SYNC_TTS}
            />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab
              auditLogs={auditLogs}
              memoryProfile={memoryProfile}
              onRefreshAudit={fetchAudit}
              onRefreshMemory={fetchMemory}
              formatJsonCompact={formatJsonCompact}
            />
          </TabsContent>
        </Tabs>
    </DashboardShell>
  );
}

export default AstroDashboard;
