export class WebCrawler {
  private static readonly MIN_DELAY = 800;
  private lastFetch = 0;

  private async waitForCooldown(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastFetch;
    if (delta < WebCrawler.MIN_DELAY) {
      await new Promise((resolve) => setTimeout(resolve, WebCrawler.MIN_DELAY - delta));
    }
    this.lastFetch = Date.now();
  }

  async fetchPage(url: string): Promise<string> {
    await this.waitForCooldown();
    const res = await fetch(url, { headers: { 'User-Agent': 'Jarvis-LearningBot/1.0' } });
    if (!res.ok) throw new Error(`Crawl failed ${res.status}`);
    return res.text();
  }
}
