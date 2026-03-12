import { URL } from 'node:url';

export class YouTubeCrawler {
  private static readonly FETCH_DELAY_MS = 600;
  private lastFetch = 0;

  private async ensureDelay(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastFetch;
    if (delta < YouTubeCrawler.FETCH_DELAY_MS) {
      const wait = YouTubeCrawler.FETCH_DELAY_MS - delta;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastFetch = Date.now();
  }

  private normalizeUrl(value: string): { videoId: string; title: string } {
    const parsed = new URL(value);
    if (!parsed.hostname.includes('youtube.com') && !parsed.hostname.includes('youtu.be')) {
      throw new Error('Only YouTube URLs supported');
    }
    let videoId = '';
    if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1);
    } else {
      videoId = parsed.searchParams.get('v') || '';
    }
    if (!videoId) throw new Error('Unable to detect video id from URL');
    const title = `YouTube Video ${videoId}`;
    return { videoId, title };
  }

  async fetchTranscript(url: string): Promise<{ title: string; channel: string; transcript: string[] }> {
    await this.ensureDelay();
    const { videoId, title } = this.normalizeUrl(url);
    const transcriptUrl = `https://r.jina.ai/https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    try {
      const resp = await fetch(transcriptUrl, { headers: { 'User-Agent': 'Jarvis-learning/1.0' } });
      if (!resp.ok) throw new Error(`Transcript fetch failed: ${resp.status}`);
      const body = await resp.text();
      const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
      return { title, channel: 'YouTube Channel', transcript: lines.slice(0, 400) };
    } catch (err) {
      console.warn('[YouTubeCrawler] transcript fetch error', err);
      return { title, channel: 'YouTube Channel', transcript: [`Transcript unavailable: ${String(err)}`] };
    }
  }
}
