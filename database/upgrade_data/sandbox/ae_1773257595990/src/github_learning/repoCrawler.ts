import { GITHUB_API_TOKEN } from '../config.js';

interface RepoMeta {
  owner: string;
  repo: string;
}

interface RepoInfo {
  name: string;
  owner: string;
  description: string;
  default_branch: string;
  language: string;
  files: string[];
}

export class RepoCrawler {
  private static readonly MIN_DELAY_MS = 800;
  private lastCall = 0;

  private async throttle() {
    const now = Date.now();
    const delta = now - this.lastCall;
    if (delta < RepoCrawler.MIN_DELAY_MS) await new Promise((r) => setTimeout(r, RepoCrawler.MIN_DELAY_MS - delta));
    this.lastCall = Date.now();
  }

  private parseRepo(url: string): RepoMeta | null {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
    } catch {
      return null;
    }
  }

  private headers() {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
    if (GITHUB_API_TOKEN) headers.Authorization = `token ${GITHUB_API_TOKEN}`;
    return headers;
  }

  async fetchRepo(url: string): Promise<RepoInfo | null> {
    const meta = this.parseRepo(url);
    if (!meta) return null;
    await this.throttle();
    const repoResp = await fetch(`https://api.github.com/repos/${meta.owner}/${meta.repo}`, { headers: this.headers() });
    if (!repoResp.ok) return null;
    const repo = await repoResp.json();
    const branch = repo.default_branch || 'main';
    await this.throttle();
    const treeResp = await fetch(`https://api.github.com/repos/${meta.owner}/${meta.repo}/git/trees/${branch}?recursive=1`, { headers: this.headers() });
    if (!treeResp.ok) return null;
    const tree = await treeResp.json();
    const files: string[] = Array.isArray(tree.tree) ? tree.tree.map((entry: any) => entry.path) : [];
    return {
      name: repo.name,
      owner: meta.owner,
      description: repo.description || '',
      default_branch: branch,
      language: repo.language || 'unknown',
      files,
    };
  }

  async fetchFile(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
    await this.throttle();
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    const resp = await fetch(rawUrl, { headers: this.headers() });
    if (!resp.ok) return null;
    return resp.text();
  }
}
