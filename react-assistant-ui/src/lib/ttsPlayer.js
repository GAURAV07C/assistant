export class TTSPlayer {
  constructor() {
    this.queue = [];
    this.playing = false;
    this.enabled = true;
    this.stopped = false;
    this.fallbackEnabled = true;
    this.fallbackStreamBuffer = '';
    // Next.js can evaluate this file during SSR. Guard browser-only APIs.
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    if (this.audio) this.audio.preload = 'auto';
  }

  unlock() {
    if (!this.audio) return;
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
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
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
    if (!this.audio) return;
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
    if (typeof window === 'undefined') return undefined;
    if (!window.speechSynthesis?.getVoices) return undefined;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => /^hi-IN$/i.test(v.lang))
      || voices.find((v) => /^en-IN$/i.test(v.lang))
      || voices.find((v) => /india|hindi|hinglish/i.test(`${v.name} ${v.lang}`));
  }

  speakFallback(text, append = false) {
    if (!this.enabled || this.stopped || !this.fallbackEnabled) return;
    if (typeof window === 'undefined') return;
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

  speakFallbackProgress() {
    if (!this.enabled || this.stopped || !this.fallbackEnabled) return false;
    const buffer = this.fallbackStreamBuffer.trim();
    if (buffer.length < 80) return false;
    const parts = this.fallbackStreamBuffer.split(/\s+/);
    if (parts.length < 10) return false;
    const cut = Math.floor(parts.length * 0.6);
    const head = parts.slice(0, cut).join(' ').trim();
    const tail = parts.slice(cut).join(' ').trim();
    if (!head) return false;
    this.fallbackStreamBuffer = tail;
    this.speakFallback(head, true);
    return true;
  }

  flushFallbackStream() {
    const rem = this.fallbackStreamBuffer.trim();
    this.fallbackStreamBuffer = '';
    if (rem) this.speakFallback(rem, true);
  }

  isBusy() {
    const browserSpeaking = typeof window !== 'undefined'
      ? !!(window.speechSynthesis && window.speechSynthesis.speaking)
      : false;
    return this.playing || this.queue.length > 0 || browserSpeaking;
  }
}
