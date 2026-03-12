import { tts } from 'edge-tts/out/index.js';
import { VoiceService } from '../core/voice/voiceService.js';

export class TTSService {
  constructor(private voiceService: VoiceService) {}

  async synthesizeBase64(text: string): Promise<string> {
    const cfg = this.voiceService.resolveRuntimeVoice();
    const audio = await tts(text, { voice: cfg.voice, rate: cfg.rate });
    return audio.toString('base64');
  }

  async synthesizeRaw(text: string): Promise<Buffer> {
    const cfg = this.voiceService.resolveRuntimeVoice();
    return tts(text, { voice: cfg.voice, rate: cfg.rate });
  }

  async synthesizeInlineTTS(textChunk: string): Promise<string> {
    return this.synthesizeBase64(textChunk);
  }
}

export const splitRegex = /(?<=[.!?,;:])\s+/;

export function splitSentences(buffer: string): { sentences: string[]; remaining: string } {
  const parts = buffer.split(splitRegex);
  if (parts.length <= 1) return { sentences: [], remaining: buffer };

  const raw = parts.slice(0, -1).map((x) => x.trim()).filter(Boolean);
  const sentences: string[] = [];
  let pending = '';

  for (const s0 of raw) {
    const s = pending ? `${pending} ${s0}`.trim() : s0;
    pending = '';
    const minReq = sentences.length === 0 ? 2 : 3;
    if (s.split(/\s+/).length < minReq) {
      pending = s;
      continue;
    }
    sentences.push(s);
  }

  const tail = parts[parts.length - 1].trim();
  const remaining = pending ? `${pending} ${tail}`.trim() : tail;
  return { sentences, remaining };
}

export function mergeShort(sentences: string[]): string[] {
  if (sentences.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; ) {
    let cur = sentences[i];
    let j = i + 1;
    while (j < sentences.length && sentences[j].split(/\s+/).length <= 2) {
      cur = `${cur} ${sentences[j]}`.trim();
      j += 1;
    }
    out.push(cur);
    i = j;
  }
  return out;
}
