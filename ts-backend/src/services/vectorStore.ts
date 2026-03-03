import fs from 'node:fs';
import path from 'node:path';
import { CHATS_DATA_DIR, CHUNK_OVERLAP, CHUNK_SIZE, LEARNING_DATA_DIR } from '../config.js';

export interface RetrievedDoc {
  pageContent: string;
  source: string;
}
export interface RetrievedDocScored extends RetrievedDoc {
  score: number;
}

interface ChunkRecord extends RetrievedDoc {
  terms: Map<string, number>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + CHUNK_SIZE, text.length);
    out.push(text.slice(i, end));
    if (end === text.length) break;
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return out;
}

export class VectorStoreService {
  private chunks: ChunkRecord[] = [];

  createVectorStore(): void {
    const docs: RetrievedDoc[] = [];

    if (fs.existsSync(LEARNING_DATA_DIR)) {
      const files = fs.readdirSync(LEARNING_DATA_DIR).filter((f) => f.endsWith('.txt')).sort();
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(LEARNING_DATA_DIR, file), 'utf8').trim();
          if (content) docs.push({ pageContent: content, source: file });
        } catch {
          // ignore
        }
      }
    }

    if (fs.existsSync(CHATS_DATA_DIR)) {
      const files = fs.readdirSync(CHATS_DATA_DIR).filter((f) => f.endsWith('.json')).sort();
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(CHATS_DATA_DIR, file), 'utf8');
          const parsed = JSON.parse(raw) as { messages?: Array<{ role: string; content: string }> };
          const content = (parsed.messages || [])
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || ''}`)
            .join('\n')
            .trim();
          if (content) docs.push({ pageContent: content, source: `chat_${file}` });
        } catch {
          // ignore
        }
      }
    }

    const chunked: ChunkRecord[] = [];
    for (const doc of docs) {
      for (const chunk of splitIntoChunks(doc.pageContent)) {
        const terms = termFreq(tokenize(chunk));
        chunked.push({ pageContent: chunk, source: doc.source, terms });
      }
    }

    if (chunked.length === 0) {
      chunked.push({
        pageContent: 'No data available yet.',
        source: 'placeholder',
        terms: termFreq(tokenize('No data available yet.')),
      });
    }

    this.chunks = chunked;
  }

  retrieve(question: string, k = 10): RetrievedDoc[] {
    return this.retrieveWithScores(question, k).map((s) => ({ pageContent: s.pageContent, source: s.source }));
  }

  retrieveWithScores(question: string, k = 10): RetrievedDocScored[] {
    const qTerms = termFreq(tokenize(question));
    const scores = this.chunks.map((chunk) => {
      let score = 0;
      for (const [term, qCount] of qTerms.entries()) {
        const cCount = chunk.terms.get(term) || 0;
        score += qCount * cCount;
      }
      return { chunk, score };
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => ({ pageContent: s.chunk.pageContent, source: s.chunk.source, score: s.score }));
  }
}
