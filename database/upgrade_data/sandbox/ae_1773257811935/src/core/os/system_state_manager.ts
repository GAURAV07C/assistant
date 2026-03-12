import { SystemStateManager, SystemStateSnapshot } from './core_controller.js';

export class SystemStateManagerImpl implements SystemStateManager {
  private status: SystemStateSnapshot['status'] = 'idle';
  private queue = 0;
  private active?: string;

  markBusy() {
    this.status = 'busy';
    this.queue += 1;
  }

  markIdle() {
    this.status = 'idle';
    if (this.queue > 0) this.queue -= 1;
  }

  currentContext(): Record<string, unknown> {
    return { status: this.status, queueDepth: this.queue };
  }

  async trackTask(taskId: string): Promise<void> {
    this.active = taskId;
  }

  snapshot(): SystemStateSnapshot {
    return { status: this.status, queueDepth: this.queue, activeTask: this.active };
  }
}
