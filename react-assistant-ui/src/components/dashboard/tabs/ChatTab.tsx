import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';

export function ChatTab({
  transcriptRef,
  hasMessages,
  rightItems,
  streaming,
  input,
  onInputChange,
  onSend,
  onToggleMic,
  micSupported,
  micListening,
  onPlan,
  onAgentRun,
  mode,
  statusLine,
  onRefreshLogs,
  onRefreshMemory,
  onRefreshVoice,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={transcriptRef}
            className="h-[55vh] overflow-auto space-y-3 rounded-lg border bg-card/40 p-3 backdrop-blur"
          >
            {!hasMessages ? (
              <div className="text-sm text-muted-foreground">
                Start conversation from the composer below.
              </div>
            ) : (
              rightItems.map((entry) => (
                <div
                  key={entry.key}
                  className="space-y-1 rounded-lg border bg-card/40 p-3 backdrop-blur"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                      {entry.role}
                    </div>
                    <Badge variant={entry.role === 'USER_CMD' ? 'outline' : 'default'}>
                      {entry.role === 'USER_CMD' ? 'You' : 'Astro'}
                    </Badge>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-foreground">
                    {entry.text || (streaming ? '...' : '(empty)')}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onSend?.();
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder="Type your command..."
              rows={3}
              maxLength={32000}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onToggleMic}
                disabled={!micSupported || streaming}
              >
                {micListening ? 'Listening...' : 'Mic'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onPlan}
                disabled={streaming || !input.trim()}
              >
                Plan
              </Button>
              <Button type="button" onClick={onAgentRun} disabled={streaming || !input.trim()}>
                Agent Run
              </Button>
              <Button type="submit" disabled={streaming || !input.trim()}>
                {streaming ? 'Sending...' : 'Send'}
              </Button>
              <div className="text-xs text-muted-foreground">
                {mode === 'realtime' ? 'Endpoint: /chat/realtime/stream' : 'Endpoint: /chat/stream'}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{statusLine}</div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <Button variant="secondary" type="button" onClick={onRefreshLogs}>
              Refresh Logs
            </Button>
            <Button variant="secondary" type="button" onClick={onRefreshMemory}>
              Refresh Memory
            </Button>
            <Button variant="secondary" type="button" onClick={onRefreshVoice}>
              Refresh Voice
            </Button>
          </div>
          <Separator />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Mic</div>
            <div className="text-sm text-foreground">
              {micSupported ? 'Supported' : 'Unsupported in this browser'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
