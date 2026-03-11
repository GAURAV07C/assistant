'use client';

import { useMemo, useState } from 'react';
import { Button } from '../ui/button';

type VoiceControlCenterProps = {
  voiceEnabled: boolean;
  voiceMuted: boolean;
  selectedVoice: string;
  voiceFile: File | null;
  voicePreview: string;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onSelectVoice: (voice: string) => void;
  onUploadVoice: (file: File | null) => void;
  onTriggerVoiceChat: () => void;
};

const AVAILABLE_VOICES = ['Aurora', 'Nimbus', 'Echo', 'Solstice'];

export function VoiceControlCenter({
  voiceEnabled,
  voiceMuted,
  selectedVoice,
  voiceFile,
  voicePreview,
  onToggleVoice,
  onToggleMute,
  onSelectVoice,
  onUploadVoice,
  onTriggerVoiceChat,
}: VoiceControlCenterProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const status = useMemo(() => {
    if (!voiceEnabled) return 'Voice disabled';
    if (voiceMuted) return 'Muted';
    return 'Live';
  }, [voiceEnabled, voiceMuted]);

  return (
    <div className="relative flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        onClick={() => {
          setPanelOpen((prev) => {
            const next = !prev;
            if (!prev) {
              onTriggerVoiceChat();
            }
            return next;
          });
        }}
        className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/80 bg-gradient-to-br from-cyan-500/30 to-purple-500/20 text-sm font-semibold text-white shadow-[0_0_30px_rgba(12,214,255,0.35)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        <span className="flex flex-col items-center text-center text-[11px]">
          <span className="text-2xl">🎤</span>
          <span className="mt-1 text-[10px]">Voice</span>
        </span>
      </button>
      <p className="text-[11px] text-slate-300">Status: {status}</p>
      {panelOpen ? (
        <div className="z-10 w-[320px] rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 text-[11px] text-slate-100 shadow-2xl shadow-slate-950/40">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onToggleVoice}>
                {voiceEnabled ? 'Disable Voice' : 'Enable Voice'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onToggleMute}>
                {voiceMuted ? 'Unmute' : 'Mute'}
              </Button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400">Voice Profile</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedVoice}
                  onChange={(e) => onSelectVoice(e.target.value)}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                >
                  {AVAILABLE_VOICES.map((voice) => (
                    <option key={voice} value={voice} className="bg-slate-900 text-slate-100">
                      {voice}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" size="sm" onClick={onTriggerVoiceChat}>
                  Talk
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400">Upload Voice Sample</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onUploadVoice(file);
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-100"
              />
              {voiceFile ? (
                <div className="flex items-center justify-between text-[10px] text-slate-300">
                  <span>{voiceFile.name}</span>
                  {voicePreview ? (
                    <audio controls src={voicePreview} className="h-6" />
                  ) : (
                    <span>Processing...</span>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">Drop a sample to personalise your assistant.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Tap to open voice hub</p>
      )}
    </div>
  );
}
