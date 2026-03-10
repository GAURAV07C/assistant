import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';

export function DashboardHeader({
  apiBase,
  sessionId,
  health,
  mode,
  agentMode,
  ttsEnabled,
  onToggleTts,
  onRefresh,
  onNewChat,
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold tracking-wide">
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
              ASTRO / JARVIS
            </span>
          </div>
          <Badge variant={health === 'ONLINE' ? 'cyan' : 'danger'}>
            {health === 'ONLINE' ? 'Backend Online' : health === 'CHECKING' ? 'Checking...' : 'Backend Offline'}
          </Badge>
          <Badge variant="outline">{mode === 'realtime' ? 'Realtime' : 'General'}</Badge>
          <Badge variant="outline">{agentMode === 'strategic' ? 'Strategic Agent' : 'Casual Agent'}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          API: <span className="text-foreground">{apiBase}</span>
          {' · '}Session: <span className="text-foreground">{sessionId ? sessionId.slice(0, 12) : 'new'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 backdrop-blur">
          <div className="text-xs text-muted-foreground">Voice</div>
          <Switch checked={ttsEnabled} onCheckedChange={onToggleTts} />
        </div>
        <Button variant="secondary" type="button" onClick={onRefresh}>
          Refresh
        </Button>
        <Button type="button" onClick={onNewChat}>
          New Chat
        </Button>
      </div>
    </header>
  );
}
