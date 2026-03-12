import type { VectorRecord } from './vector_store.js';
import { SemanticSearch } from './semantic_search.js';

export class RetrievalEngine {
  constructor(private readonly semantic: SemanticSearch) {}

  retrieve(query: string, topK = 6): VectorRecord[] {
    return this.semantic.search(query, topK);
  }
}
