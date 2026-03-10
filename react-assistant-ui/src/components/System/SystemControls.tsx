import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function SystemControls({
  onAction,
}: {
  onAction: (action: 'start' | 'stop' | 'restart' | 'clear_memory' | 'refresh_knowledge') => void;
}) {
  return (
    <Card className="border-slate-800/80 bg-slate-950/65">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">System Control Panel</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={() => onAction('start')}>Start Agents</Button>
        <Button type="button" variant="secondary" onClick={() => onAction('stop')}>Stop Agents</Button>
        <Button type="button" variant="secondary" onClick={() => onAction('restart')}>Restart System</Button>
        <Button type="button" variant="secondary" onClick={() => onAction('clear_memory')}>Clear Memory</Button>
        <Button type="button" variant="secondary" onClick={() => onAction('refresh_knowledge')}>Refresh Knowledge</Button>
      </CardContent>
    </Card>
  );
}
