export type ToolHandler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class ToolRegistry {
  private readonly map = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler): void {
    this.map.set(name, handler);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  get(name: string): ToolHandler | null {
    return this.map.get(name) || null;
  }

  list(): string[] {
    return Array.from(this.map.keys());
  }
}
