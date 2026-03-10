'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

export function ChatInput({
  onSend,
  disabled,
  voiceEnabled,
  onVoiceEnabledChange,
}: {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  voiceEnabled?: boolean;
  onVoiceEnabledChange?: (v: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  function getSpeechCtor() {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  function toggleMic() {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;

    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
      return;
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event: any) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setValue((prev) => `${prev} ${text}`.trim());
    };
    rec.start();
  }

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/65 p-3">
      <Textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask AI_OS_V3..."
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={toggleMic} disabled={disabled}>
            {listening ? 'Stop Mic' : 'Mic Input'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onVoiceEnabledChange?.(!voiceEnabled)}
            disabled={disabled}
          >
            {voiceEnabled ? 'Voice On' : 'Voice Off'}
          </Button>
        </div>
        <Button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={async () => {
            const payload = value.trim();
            if (!payload) return;
            setValue('');
            await onSend(payload);
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
