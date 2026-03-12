import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const AWARENESS_FILE = path.join(UPGRADE_DATA_DIR, 'awareness_state.json');

export interface AwarenessState {
  updated_at: string;
  curiosity_score: number;
  known_concepts: string[];
  knowledge_gaps: string[];
  generated_questions: string[];
  active_learning_focus: string[];
}

export class AwarenessStateStore {
  read(): AwarenessState {
    if (!fs.existsSync(AWARENESS_FILE)) {
      return {
        updated_at: new Date().toISOString(),
        curiosity_score: 0,
        known_concepts: [],
        knowledge_gaps: [],
        generated_questions: [],
        active_learning_focus: [],
      };
    }
    try {
      return JSON.parse(fs.readFileSync(AWARENESS_FILE, 'utf8')) as AwarenessState;
    } catch {
      return {
        updated_at: new Date().toISOString(),
        curiosity_score: 0,
        known_concepts: [],
        knowledge_gaps: [],
        generated_questions: [],
        active_learning_focus: [],
      };
    }
  }

  write(input: AwarenessState): void {
    fs.mkdirSync(path.dirname(AWARENESS_FILE), { recursive: true });
    fs.writeFileSync(
      AWARENESS_FILE,
      JSON.stringify({ ...input, updated_at: new Date().toISOString() }, null, 2),
      'utf8',
    );
  }
}
