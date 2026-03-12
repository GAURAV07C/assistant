import fs from 'node:fs';
import path from 'node:path';

export interface ModificationDescriptor {
  relativePath: string;
  content?: string;
  updater?: (current: string) => string;
  ensureParent?: boolean;
}

export class CodeModifier {
  async apply(basePath: string, modifications: ModificationDescriptor[]): Promise<void> {
    for (const change of modifications) {
      const target = path.join(basePath, change.relativePath);
      if (change.ensureParent) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
      }

      if (change.updater) {
        const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        fs.writeFileSync(target, change.updater(current), 'utf8');
      } else if (typeof change.content === 'string') {
        fs.writeFileSync(target, change.content, 'utf8');
      }
    }
  }
}
