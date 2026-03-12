export type TaskRouteResult = {
  taskId: string;
  result: string;
};

export interface SystemStateManager {
  markBusy(): void;
  markIdle(): void;
  currentContext(): Record<string, unknown>;
  trackTask(taskId: string): Promise<void>;
  snapshot(): SystemStateSnapshot;
}

export type SystemStateSnapshot = {
  status: 'idle' | 'busy' | 'error';
  queueDepth: number;
  activeTask?: string;
};

export interface TaskRouter {
  route(request: string, context: Record<string, unknown>): TaskRouteResult;
}

export class CoreController {
  constructor(private stateManager: SystemStateManager, private taskRouter: TaskRouter) {}

  async executeRequest(request: string): Promise<string> {
    this.stateManager.markBusy();
    const context = this.stateManager.currentContext();
    const routed = this.taskRouter.route(request, context);
    await this.stateManager.trackTask(routed.taskId);
    this.stateManager.markIdle();
    return routed.result;
  }
}
