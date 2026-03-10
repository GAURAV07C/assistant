import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

export function LogsTab({ auditLogs, memoryProfile, onRefreshAudit, onRefreshMemory, formatJsonCompact }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" variant="secondary" onClick={onRefreshAudit}>
            Refresh
          </Button>
          <pre className="max-h-[65vh] overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
            {formatJsonCompact(auditLogs)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" variant="secondary" onClick={onRefreshMemory}>
            Refresh
          </Button>
          <pre className="max-h-[65vh] overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
            {formatJsonCompact(memoryProfile)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

