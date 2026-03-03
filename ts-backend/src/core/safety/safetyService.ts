import path from 'node:path';

const BLOCK_PATTERNS: RegExp[] = [
  /\b(rm\s+-rf|git\s+reset\s+--hard|curl\s+.*https?:\/\/|wget\s+https?:\/\/)/i,
  /\b(api[_-]?key|token|password|secret|private[_-]?key)\b.*\b(send|upload|exfiltrate|share|post)\b/i,
];

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
}
