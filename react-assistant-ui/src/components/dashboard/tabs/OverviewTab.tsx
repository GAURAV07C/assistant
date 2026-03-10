import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Separator } from '../../ui/separator';

export function OverviewTab({
  memoryProfile,
  auditLogs,
  ttsEnabled,
  actionNodes,
  onNodeAction,
  featureMatrix,
  evolutionStatus,
  curriculumNext,
  routerStats,
  formatJsonCompact,
}) {
  const systemScore = evolutionStatus?.system_intelligence_score ?? 0;
  const activeAgents = evolutionStatus?.agents?.length ?? 0;
  const recentAgentRuns = evolutionStatus?.agent_activity?.length ?? 0;
  const researchTopics = evolutionStatus?.autonomous_research?.topics_detected ?? [];
  const learningGoals = evolutionStatus?.meta_intelligence?.learning_goals ?? [];
  const awareness = evolutionStatus?.awareness || null;
  const vectorMemory = evolutionStatus?.vector_memory || null;
  const goals = evolutionStatus?.long_term_goals || null;
  const taskMemory = evolutionStatus?.task_memory || null;
  const selfEvolution = evolutionStatus?.self_evolution || null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>System Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Memory Records</span>
            <span className="text-foreground">{memoryProfile?.records_count ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Learning Files</span>
            <span className="text-foreground">{memoryProfile?.learning_files?.length ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Audit Logs</span>
            <span className="text-foreground">{auditLogs?.length ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Voice</span>
            <span className="text-foreground">{ttsEnabled ? 'Enabled' : 'Muted'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">System Intelligence</span>
            <span className="text-foreground">{systemScore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active Agents</span>
            <span className="text-foreground">{activeAgents}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Recent Agent Runs</span>
            <span className="text-foreground">{recentAgentRuns}</span>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 gap-2">
            {actionNodes.map((n) => (
              <Button
                key={n.title}
                variant="secondary"
                type="button"
                onClick={() => {
                  void onNodeAction?.(n.action);
                }}
              >
                {n.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Feature Matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {featureMatrix.map((f) => (
              <div
                key={f.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card/40 p-3 backdrop-blur"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.note}</div>
                </div>
                <Badge
                  variant={
                    f.status === 'READY' ? 'cyan' : f.status === 'PARTIAL' ? 'outline' : 'danger'
                  }
                >
                  {f.status}
                </Badge>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Evolution</div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(evolutionStatus)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Curriculum (Next)</div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(curriculumNext)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Router Stats</div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(routerStats)}
              </pre>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Meta Intelligence</div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(evolutionStatus?.meta_intelligence)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Autonomous Research</div>
              <div className="rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
                <div>Topics: {researchTopics.length ? researchTopics.join(', ') : 'none'}</div>
                <div className="mt-1">Runs: {evolutionStatus?.autonomous_research?.ran ? 'active' : 'idle'}</div>
              </div>
              <pre className="max-h-24 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(evolutionStatus?.autonomous_research)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Self Improvement</div>
              <div className="rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
                <div>Learning Goals: {learningGoals.length}</div>
                <div className="mt-1">Plan: {evolutionStatus?.self_improvement?.projected_impact || 'n/a'}</div>
              </div>
              <pre className="max-h-24 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(evolutionStatus?.self_improvement)}
              </pre>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Vector Memory</div>
              <div className="rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
                <div>Total Vectors: {vectorMemory?.total_vectors ?? 0}</div>
                <div className="mt-1">Latest: {vectorMemory?.latest_update || 'n/a'}</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Long-Term Goals</div>
              <div className="rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
                <div>Total: {goals?.evaluation?.total_goals ?? 0}</div>
                <div className="mt-1">Completed: {goals?.evaluation?.completed_goals ?? 0}</div>
                <div className="mt-1">Avg Progress: {goals?.evaluation?.average_progress ?? 0}%</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Task Memory Analytics</div>
              <div className="rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
                <div>Success Rate: {taskMemory?.success?.success_rate ?? 0}</div>
                <div className="mt-1">Avg Score: {taskMemory?.success?.avg_score ?? 0}</div>
                <div className="mt-1">Reuse Candidates: {taskMemory?.reuse_sample?.reuse_candidates?.length ?? 0}</div>
              </div>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Evolution Proposals</div>
            <pre className="max-h-36 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
              {formatJsonCompact(selfEvolution?.proposals || [])}
            </pre>
          </div>
          <Separator className="my-3" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Awareness Engine</div>
            <div className="rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
              <div>Curiosity Score: {awareness?.curiosity_score ?? 0}</div>
              <div className="mt-1">Knowledge Gaps: {Array.isArray(awareness?.knowledge_gaps) ? awareness.knowledge_gaps.length : 0}</div>
              <div className="mt-1">Questions: {Array.isArray(awareness?.generated_questions) ? awareness.generated_questions.length : 0}</div>
            </div>
            <pre className="max-h-36 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
              {formatJsonCompact(awareness)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
