import type { SkillProfile } from './skill_registry.js';
import { SkillMemory } from './skill_memory.js';

export interface SkillLearningInput {
  task: string;
  conversation?: string;
  assistantResponse?: string;
}

export class SkillLearningEngine {
  constructor(private readonly memory = new SkillMemory()) {}

  detectSkillCandidates(input: SkillLearningInput): string[] {
    const text = `${input.task || ''}\n${input.conversation || ''}\n${input.assistantResponse || ''}`.toLowerCase();
    const hits: string[] = [];
    const add = (id: string) => { if (!hits.includes(id)) hits.push(id); };

    if (/\b(code|typescript|javascript|react|bug|refactor|api|backend|frontend)\b/.test(text)) add('coding');
    if (/\b(research|latest|compare|docs|documentation|source|paper)\b/.test(text)) add('research');
    if (/\b(automation|script|pipeline|ci|terminal|cron)\b/.test(text)) add('automation');
    if (/\b(data|analysis|metrics|dashboard|insight|trend)\b/.test(text)) add('data_analysis');
    if (/\b(scrape|crawler|extract|html parser)\b/.test(text)) add('web_scraping');
    if (/\b(prompt|instruction|system prompt|few-shot|chain-of-thought)\b/.test(text)) add('prompt_engineering');
    if (hits.length === 0) add('coding');

    return hits;
  }

  buildKnowledgePatch(input: SkillLearningInput): { concepts: string[]; tools: string[]; best_practices: string[]; examples: string[] } {
    const task = String(input.task || '').trim();
    const convo = String(input.conversation || '').trim();
    const resp = String(input.assistantResponse || '').trim();
    const text = `${task}\n${convo}\n${resp}`.toLowerCase();

    const tools: string[] = [];
    if (/\bnpm\b/.test(text)) tools.push('npm');
    if (/\bgit\b/.test(text)) tools.push('git');
    if (/\bnode\b/.test(text)) tools.push('node');
    if (/\btypescript|ts\b/.test(text)) tools.push('typescript');
    if (/\breact\b/.test(text)) tools.push('react');

    return {
      concepts: [task].filter(Boolean),
      tools,
      best_practices: ['Prefer modular architecture', 'Validate inputs and guard unsafe operations'],
      examples: [task, convo, resp].filter(Boolean).slice(0, 3),
    };
  }

  ensureSkillProfiles(existing: SkillProfile[], detected: string[]): SkillProfile[] {
    const now = new Date().toISOString();
    const map = new Map(existing.map((s) => [s.id, s]));
    for (const id of detected) {
      if (map.has(id)) continue;
      map.set(id, {
        id,
        name: id,
        category: id.includes('analysis') ? 'analysis' : id.includes('research') || id.includes('scraping') ? 'research' : id.includes('automation') ? 'automation' : 'coding',
        description: `Auto-learned skill for ${id}`,
        enabled: true,
        level: 'beginner',
        intelligence_score: 0,
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        updated_at: now,
      });
    }
    return Array.from(map.values());
  }

  learn(skillId: string, input: SkillLearningInput) {
    const patch = this.buildKnowledgePatch(input);
    return this.memory.updateSkillMemory(skillId, patch);
  }
}
