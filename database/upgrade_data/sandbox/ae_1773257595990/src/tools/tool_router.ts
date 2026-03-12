import type { ToolExecutor } from './tool_executor.js';
import type { ToolPermissions } from './tool_permissions.js';

export class AgentToolRouter {
  constructor(
    private readonly permissions: ToolPermissions,
    private readonly executor: ToolExecutor,
  ) {}

  async route(input: {
    agent_id: string;
    tool_name: string;
    payload: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    if (!this.permissions.allowed(input.agent_id, input.tool_name)) {
      return { ok: false, detail: `permission_denied:${input.agent_id}:${input.tool_name}` };
    }
    return this.executor.execute(input.tool_name, input.payload);
  }
}
