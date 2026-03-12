import path from 'node:path';

const BLOCK_PATTERNS: RegExp[] = [
  /\b(rm\s+-rf|git\s+reset\s+--hard|curl\s+.*https?:\/\/|wget\s+https?:\/\/)/i,
  /\b(api[_-]?key|token|password|secret|private[_-]?key)\b.*\b(send|upload|exfiltrate|share|post)\b/i,
];

export type SafetyActionType = 'read' | 'write' | 'execute' | 'commit' | 'delete' | 'multi_file_modify';

export interface SafetyActionRequest {
  type: SafetyActionType;
  intent: string;
  confirm?: boolean;
  overwrite?: boolean;
  destructive?: boolean;
  multi_file_count?: number;
}

export interface SafetyDecision {
  allowed: boolean;
  needs_confirmation: boolean;
  reason?: string;
}

export class SafetyService {
  isInstructionSafe(instruction: string): { allowed: boolean; reason?: string } {
    const text = String(instruction || '');
    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.test(text)) {
        return { allowed: false, reason: 'Instruction matched blocked safety pattern.' };
      }
    }
    return { allowed: true };
  }

  isFilePathAllowed(filePath: string | undefined, workspaceRoot: string | undefined): { allowed: boolean; reason?: string } {
    if (!filePath) return { allowed: true };

    const normalizedFile = path.resolve(filePath);
    if (workspaceRoot) {
      const normalizedRoot = path.resolve(workspaceRoot);
      if (!normalizedFile.startsWith(normalizedRoot + path.sep) && normalizedFile !== normalizedRoot) {
        return { allowed: false, reason: 'file_path is outside workspace_root allow-list.' };
      }
    }

    return { allowed: true };
  }

  assessAction(req: SafetyActionRequest): SafetyDecision {
    const safe = this.isInstructionSafe(req.intent);
    if (!safe.allowed) {
      return { allowed: false, needs_confirmation: false, reason: safe.reason };
    }

    const needsConfirmation = this.requiresConfirmation(req);
    if (needsConfirmation && !req.confirm) {
      return {
        allowed: false,
        needs_confirmation: true,
        reason: 'Confirmation required for this action type.',
      };
    }

    return { allowed: true, needs_confirmation: needsConfirmation };
  }

  private requiresConfirmation(req: SafetyActionRequest): boolean {
    if (req.type === 'commit') return true;
    if (req.type === 'delete') return true;
    if (req.type === 'execute') return true;
    if (req.type === 'multi_file_modify') return true;
    if (req.type === 'write' && req.overwrite) return true;
    if (req.destructive) return true;
    if ((req.multi_file_count || 0) > 1) return true;
    return false;
  }
}
