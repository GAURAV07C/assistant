export class ToolPermissions {
  private readonly perms: Record<string, string[]> = {
    coding_agent: ['analyze', 'fix', 'refactor', 'file_ops', 'doc_retrieve'],
    debug_agent: ['analyze', 'fix', 'terminal_ops', 'anti_pattern_check'],
    research_agent: ['web_lookup', 'doc_retrieve', 'analyze'],
    learning_agent: ['skill_update', 'doc_retrieve', 'web_lookup'],
    planning_agent: ['analyze', 'doc_retrieve'],
    automation_agent: ['terminal_ops', 'git_ops', 'file_ops'],
    evaluation_agent: ['analyze', 'doc_retrieve'],
    system: ['analyze', 'fix', 'refactor', 'complete', 'snippet_generate', 'git_commit', 'memory_update', 'doc_retrieve', 'skill_update', 'anti_pattern_check', 'file_ops', 'git_ops', 'terminal_ops', 'web_lookup', 'explain'],
  };

  allowed(agentId: string, toolName: string): boolean {
    const list = this.perms[agentId] || this.perms.system || [];
    return list.includes(toolName);
  }
}
