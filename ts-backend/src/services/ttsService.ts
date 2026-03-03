import { tts } from 'edge-tts/out/index.js';
import { TTS_RATE, TTS_VOICE } from '../config.js';

export class TTSService {
  async synthesizeBase64(text: string, voice = TTS_VOICE, rate = TTS_RATE): Promise<string> {
    const audio = await tts(text, { voice, rate });
    return audio.toString('base64');
  }

  async synthesizeRaw(text: string, voice = TTS_VOICE, rate = TTS_RATE): Promise<Buffer> {
    return tts(text, { voice, rate });
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
