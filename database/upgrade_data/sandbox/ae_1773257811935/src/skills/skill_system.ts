import { builtinSkills } from './skill_registry.js';
import type { SkillModule } from './types.js';
import { SkillTracker } from './skill_tracker.js';

export interface SkillSelection {
  selected: SkillModule[];
  reasons: string[];
}

export class SkillSystem {
  private readonly skills = builtinSkills();
  private readonly tracker = new SkillTracker();

  list(): SkillModule[] {
    return this.skills.slice();
  }

  selectForRequest(message: string, intent: string): SkillSelection {
    const text = String(message || '').toLowerCase();
    const picked: SkillModule[] = [];
    const reasons: string[] = [];

    const pick = (id: string, reason: string) => {
      const skill = this.skills.find((s) => s.id === id);
      if (!skill) return;
      if (picked.some((p) => p.id === skill.id)) return;
      picked.push(skill);
      reasons.push(reason);
    };

    if (intent === 'coding' || intent === 'debugging' || /\b(code|bug|refactor|api|typescript|react)\b/.test(text)) {
      pick('coding.core', 'Coding/debug signals found.');
    }
    if (intent === 'planning' || /\b(plan|roadmap|milestone|schedule)\b/.test(text)) {
      pick('productivity.flow', 'Planning intent detected.');
    }
    if (/\b(research|compare|sources?|latest|benchmark)\b/.test(text)) {
      pick('research.web', 'Research terms detected.');
    }
    if (/\b(automate|script|terminal|command|ops)\b/.test(text)) {
      pick('automation.ops', 'Automation/ops terms detected.');
    }
    if (/\b(analy[sz]e|performance|security|quality|review)\b/.test(text)) {
      pick('analysis.quality', 'Analysis keywords detected.');
    }

    if (picked.length === 0) {
      pick('productivity.flow', 'Default planning/productivity skill applied.');
    }

    return { selected: picked, reasons };
  }

  selectSkill(taskType: string, context?: string): SkillModule | null {
    const decision = this.selectForRequest(`${taskType}\n${context || ''}`, taskType);
    return decision.selected.length > 0 ? decision.selected[0] : null;
  }

  executeSkill(skillId: string, input: { message: string; context?: Record<string, unknown> }): { summary: string; suggested_tools: string[]; workflow: string[] } | null {
    const skill = this.skills.find((s) => s.id === skillId);
    if (!skill) return null;
    return skill.execute(input);
  }

  updateSkillProficiency(skillId: string, result: 'pass' | 'fail' | 'partial'): { skill_id: string; level: string; score: number } {
    const graph = this.tracker.trackSession({
      message: `${skillId} ${result}`,
      response: `skill_result:${result}`,
      intent: 'learning',
    });
    const name = skillId.split('.').pop() || skillId;
    const node = graph.nodes.find((n) => n.name.includes(name)) || graph.nodes[0] || { name: skillId, level: 'beginner', score: 0 };
    return { skill_id: skillId, level: node.level, score: node.score };
  }
}
