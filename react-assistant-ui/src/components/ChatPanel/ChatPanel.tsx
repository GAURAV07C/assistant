'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time?: string;
};

export function ChatPanel({
  messages,
  reasoningSteps,
  streamChunk,
  thinking,
  onSend,
  voiceModeOn,
  onVoiceToggle,
}: {
  messages: ChatMessage[];
  reasoningSteps: string[];
  streamChunk: string;
  thinking: boolean;
  onSend: (text: string) => Promise<void>;
  voiceModeOn: boolean;
  onVoiceToggle: (next: boolean) => void;
}) {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!voiceModeOn) return;
    const recognition = new ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)();
    recognition.continuous = false;
    recognition.lang = 'hi-IN';
    recognition.onresult = (event: any) => {
      const text = event.results[0]?.[0]?.transcript || '';
      setInput(text);
      recognition.stop();
      onVoiceToggle(false);
    };
    recognition.onerror = () => onVoiceToggle(false);
    recognition.onend = () => onVoiceToggle(false);
    recognition.start();
    return () => recognition.stop();
  }, [voiceModeOn, onVoiceToggle]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-950/60 p-4 shadow-[0_30px_55px_rgba(15,23,42,0.5)]">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        <span>System Transcription</span>
        <div className="flex items-center gap-2 text-[0.6rem] text-slate-500">
          <span>Deep Reasoning</span>
          <div className="h-2 w-8 rounded-full border border-slate-700 bg-transparent" />
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              className={`mb-3 flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm ${
                message.role === 'user'
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                  : 'border-indigo-500/30 bg-slate-900 text-slate-100'
              }`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-400">
                {message.role === 'user' ? 'USER' : 'STKAI'}
              </div>
              <p className="text-sm leading-relaxed">{message.text}</p>
              <span className="text-right text-[0.6rem] text-slate-500">{message.time || '—'}</span>
            </motion.div>
          ))}
          {streamChunk && (
            <div className="text-xs text-slate-500">Streaming: {streamChunk.slice(-120)}</div>
          )}
        </div>
        <div className="rounded-3xl border border-slate-800 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend(input.trim()).then(() => setInput(''));
                }
              }}
              className="flex-1 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs text-slate-100 focus:outline-none"
              placeholder="Type a message or tap microphone"
            />
            <button
              onClick={() => onVoiceToggle(!voiceModeOn)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold text-white transition ${
                voiceModeOn ? 'border-emerald-500 bg-emerald-500/30' : 'border-cyan-500 bg-cyan-500/20'
              }`}
            >
              {voiceModeOn ? 'Listening…' : '🎤 Voice'}
            </button>
            <button
              onClick={() => {
                if (!input.trim()) return;
                onSend(input.trim()).then(() => setInput(''));
              }}
              disabled={thinking}
              className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-100 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[0.7rem] text-slate-400">
        <div className="rounded-2xl border border-slate-800 bg-white/5 p-3">
          <div className="text-[0.5rem] uppercase tracking-[0.4em]">Chat</div>
          <div className="mt-1 text-slate-200">{thinking ? 'Thinking…' : 'Ready'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-white/5 p-3">
          <div className="text-[0.5rem] uppercase tracking-[0.4em]">Logs</div>
          <div className="mt-1 text-slate-200">{reasoningSteps.length} steps recorded</div>
        </div>
      </div>
    </div>
  );
}
