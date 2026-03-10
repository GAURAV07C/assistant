import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export type LogItem = {
  id: string;
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

export function LogConsole({ logs }: { logs: LogItem[] }) {
  return (
    <Card className="h-full border-slate-800/80 bg-slate-950/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">System Log Console</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-36 overflow-auto rounded-lg border border-slate-800/70 bg-black/35 p-2 font-mono text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className={[
              'mb-1 flex gap-2',
              log.level === 'error' ? 'text-rose-300' : log.level === 'warn' ? 'text-amber-300' : 'text-cyan-200/90',
            ].join(' ')}>
              <span className="text-slate-500">{new Date(log.ts).toLocaleTimeString()}</span>
              <span>[{log.level.toUpperCase()}]</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
