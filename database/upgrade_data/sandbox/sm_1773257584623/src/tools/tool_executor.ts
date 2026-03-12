import type { ToolRegistry } from './tool_registry.js';

export class ToolExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(toolName: string, input: Record<string, unknown>, timeoutMs = 12000): Promise<Record<string, unknown>> {
    const handler = this.registry.get(toolName);
    if (!handler) return { ok: false, detail: `tool_not_found:${toolName}` };

    let timeout: NodeJS.Timeout | null = null;
    try {
      const result = await Promise.race([
        handler(input),
        new Promise<Record<string, unknown>>((resolve) => {
          timeout = setTimeout(() => resolve({ ok: false, detail: `tool_timeout:${toolName}` }), timeoutMs);
        }),
      ]);
      return result;
    } catch (err) {
      return { ok: false, detail: `tool_error:${toolName}:${String(err)}` };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
