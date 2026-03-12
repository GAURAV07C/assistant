import path from 'node:path';
import { TestSandbox } from '../self_modification/testSandbox.js';
import type { RefactorProposal } from './refactorPlanner.js';

export interface ValidationResult {
  success: boolean;
  logs: string[];
  command?: string;
}

export class ArchitectureValidator {
  private readonly sandbox = new TestSandbox();

  async validate(sandboxPath: string, proposal: RefactorProposal): Promise<ValidationResult> {
    try {
      const result = await this.sandbox.runChecks(sandboxPath, { runTests: true });
      return { success: result.success, logs: result.outputs, command: 'npm install/build/test' };
    } catch (error) {
      return { success: false, logs: [], command: 'npm install/build/test' };
    }
  }
}
