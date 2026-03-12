import { VectorMemoryStore, type VectorRecord } from './vector_store.js';

export class SemanticSearch {
  constructor(private readonly store: VectorMemoryStore) {}

  search(query: string, topK = 5): VectorRecord[] {
    const embedding = this.store.embed(query);
    return this.store.similaritySearch(embedding, topK);
  }
}
