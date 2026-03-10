import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Separator } from '../../ui/separator';

export function AgentTab({
  input,
  streaming,
  onPlan,
  onExecute,
  agentPanelData,
  agentPanelSource,
  reflectionRecent,
  panelPlan,
  panelStepsText,
  formatJsonCompact,
  onToggleDetails,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Agent Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onPlan} disabled={streaming || !input.trim()}>
              Generate Plan
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onExecute}
              disabled={streaming || !input.trim()}
            >
              Execute Task
            </Button>
            <Button type="button" variant="secondary" onClick={onToggleDetails}>
              Toggle Details
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Latest Agent Payload</div>
              <pre className="max-h-72 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(agentPanelData)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Source</div>
              <div className="rounded-lg border bg-card/40 p-3 text-sm text-foreground backdrop-blur">
                {agentPanelSource || 'n/a'}
              </div>
              <Separator className="my-2" />
              <div className="text-xs text-muted-foreground">Reflection (Recent)</div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(reflectionRecent)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">Plan</div>
          <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
            {formatJsonCompact(panelPlan)}
          </pre>
          <div className="text-xs text-muted-foreground">Steps</div>
          <pre className="max-h-40 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
            {panelStepsText}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
