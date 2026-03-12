import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_RUNTIME_DIR } from '../config.js';
import { defaultSkillProfiles, type SkillProfile } from './skill_registry.js';
import { SkillLearningEngine, type SkillLearningInput } from './skill_learning.js';
import { SkillMemory } from './skill_memory.js';
import { SkillEvolutionEngine, type SkillResult } from './skill_evolution.js';
import { SkillSystem } from './skill_system.js';

const SKILL_REGISTRY_FILE = path.join(SKILLS_RUNTIME_DIR, 'skill_registry.json');

export class SkillEngine {
  private readonly learning = new SkillLearningEngine();
  private readonly memory = new SkillMemory();
  private readonly evolution = new SkillEvolutionEngine();
  private readonly skillSystem = new SkillSystem();

  private readProfiles(): SkillProfile[] {
    if (!fs.existsSync(SKILL_REGISTRY_FILE)) return defaultSkillProfiles();
    try {
      const raw = JSON.parse(fs.readFileSync(SKILL_REGISTRY_FILE, 'utf8')) as unknown;
      if (!Array.isArray(raw)) return defaultSkillProfiles();
      return raw as SkillProfile[];
    } catch {
      return defaultSkillProfiles();
    }
  }

  private writeProfiles(items: SkillProfile[]): void {
    fs.mkdirSync(SKILLS_RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(SKILL_REGISTRY_FILE, JSON.stringify(items, null, 2), 'utf8');
  }

  listSkills(): SkillProfile[] {
    const existing = this.readProfiles();
    const map = new Map(existing.map((s) => [s.id, s]));
    for (const s of defaultSkillProfiles()) {
      if (!map.has(s.id)) map.set(s.id, s);
    }
    const merged = Array.from(map.values()).sort((a, b) => b.intelligence_score - a.intelligence_score);
    this.writeProfiles(merged);
    return merged;
  }

  setSkillEnabled(skillId: string, enabled: boolean): SkillProfile | null {
    const profiles = this.listSkills();
    const idx = profiles.findIndex((p) => p.id === skillId);
    if (idx < 0) return null;
    profiles[idx] = { ...profiles[idx], enabled, updated_at: new Date().toISOString() };
    this.writeProfiles(profiles);
    return profiles[idx];
  }

  getSkill(skillId: string): SkillProfile | null {
    return this.listSkills().find((p) => p.id === skillId) || null;
  }

  getSkillDetails(skillId: string) {
    const profile = this.getSkill(skillId);
    if (!profile) return null;
    return {
      profile,
      memory: this.memory.getSkillMemory(skillId),
    };
  }

  detectAndLearn(input: SkillLearningInput): { detected: string[]; updated: SkillProfile[] } {
    const detected = this.learning.detectSkillCandidates(input);
    let profiles = this.learning.ensureSkillProfiles(this.listSkills(), detected);

    for (const id of detected) {
      this.memory.ensureSkillMemory(id);
      this.learning.learn(id, input);
    }
    const now = new Date().toISOString();
    profiles = profiles.map((p) => detected.includes(p.id)
      ? { ...p, usage_count: p.usage_count + 1, updated_at: now }
      : p);
    this.writeProfiles(profiles);
    return { detected, updated: profiles.filter((p) => detected.includes(p.id)) };
  }

  evolveSkill(skillId: string, result: SkillResult, notes?: string): SkillProfile | null {
    const profiles = this.listSkills();
    const idx = profiles.findIndex((p) => p.id === skillId);
    if (idx < 0) return null;
    profiles[idx] = this.evolution.evolve(profiles[idx], result, notes);
    this.writeProfiles(profiles);
    return profiles[idx];
  }

  runSkill(skillId: string, input: { message: string; context?: Record<string, unknown> }) {
    const fromBuiltin = this.skillSystem.executeSkill(skillId.includes('.') ? skillId : `${skillId}.core`, input)
      || this.skillSystem.executeSkill(skillId, input);
    if (fromBuiltin) return fromBuiltin;

    const details = this.getSkillDetails(skillId);
    if (!details) return null;
    return {
      summary: `Skill ${skillId} executed using accumulated memory`,
      suggested_tools: details.memory.tools.slice(0, 6),
      workflow: [
        `Review concepts: ${details.memory.concepts.slice(0, 2).join(' | ') || 'none'}`,
        `Apply best practices: ${details.memory.best_practices.slice(0, 2).join(' | ') || 'none'}`,
        'Return concise implementation plan',
      ],
    };
  }

  intelligenceSummary() {
    const all = this.listSkills();
    const enabled = all.filter((s) => s.enabled);
    const avg = enabled.length ? Math.round(enabled.reduce((a, b) => a + b.intelligence_score, 0) / enabled.length) : 0;
    return {
      total_skills: all.length,
      enabled_skills: enabled.length,
      average_intelligence: avg,
      top_skills: enabled.slice().sort((a, b) => b.intelligence_score - a.intelligence_score).slice(0, 5),
    };
  }
}
