export class ContextManager {
  private store: Record<string, unknown> = {};

  update(key: string, value: unknown) {
    this.store[key] = value;
  }

  snapshot(keys: string[] = []): Record<string, unknown> {
    if (!keys.length) return { ...this.store };
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in this.store) out[key] = this.store[key];
    }
    return out;
  }
}
