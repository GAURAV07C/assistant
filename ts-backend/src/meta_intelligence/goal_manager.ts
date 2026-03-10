export interface LearningGoal {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
  assigned_agent: 'learning_agent' | 'research_agent' | 'coding_agent' | 'planning_agent';
}

export interface GoalInput {
  evaluation_score: number;
  average_skill_intelligence: number;
  low_skills: string[];
  repeated_mistakes: string[];
  research_gaps: string[];
}

export class GoalManager {
  createGoals(input: GoalInput): LearningGoal[] {
    const goals: LearningGoal[] = [];

    if (input.evaluation_score < 70) {
      goals.push({
        id: 'improve_response_quality',
        title: 'Improve response quality and execution confidence',
        priority: 'high',
        reason: `Recent evaluation score is ${input.evaluation_score}`,
        assigned_agent: 'learning_agent',
      });
    }

    for (const skill of input.low_skills.slice(0, 3)) {
      goals.push({
        id: `skill_gap_${skill}`,
        title: `Close skill gap: ${skill}`,
        priority: 'medium',
        reason: 'Skill intelligence is below target threshold',
        assigned_agent: 'coding_agent',
      });
    }

    for (const gap of input.research_gaps.slice(0, 2)) {
      goals.push({
        id: `research_${gap.replace(/\s+/g, '_').toLowerCase()}`,
        title: `Research topic gap: ${gap}`,
        priority: 'medium',
        reason: 'Topic appeared frequently without enough knowledge links',
        assigned_agent: 'research_agent',
      });
    }

    if (input.repeated_mistakes.length >= 2) {
      goals.push({
        id: 'mistake_reduction_loop',
        title: 'Reduce repeated mistakes through guided planning',
        priority: 'high',
        reason: input.repeated_mistakes.slice(0, 3).join(', '),
        assigned_agent: 'planning_agent',
      });
    }

    if (input.average_skill_intelligence >= 82 && input.evaluation_score >= 78) {
      goals.push({
        id: 'advanced_optimization_track',
        title: 'Shift focus to advanced optimization and architecture tradeoffs',
        priority: 'low',
        reason: 'Core quality metrics already stable',
        assigned_agent: 'coding_agent',
      });
    }

    return goals;
  }
}
