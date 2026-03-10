import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Status = 'running' | 'idle' | 'completed';

function statusClass(status: Status) {
  if (status === 'running') return 'cyan';
  if (status === 'completed') return 'default';
  return 'outline';
}

export function AgentCard({
  name,
  status,
  progress,
  executionTimeMs,
}: {
  name: string;
  status: Status;
  progress: number;
  executionTimeMs: number;
}) {
  return (
    <Card className="border-slate-800/80 bg-slate-950/65">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm text-slate-100">{name}</CardTitle>
          <Badge variant={statusClass(status) as any}>{status.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2 rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Task Progress: {Math.round(progress)}%</span>
          <span>{executionTimeMs}ms</span>
        </div>
      </CardContent>
    </Card>
  );
}
