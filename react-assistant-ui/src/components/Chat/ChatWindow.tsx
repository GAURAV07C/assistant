import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string[];
  executedBy?: string;
};

export function ChatWindow({
  messages,
  thinking,
  reasoningSteps,
  activeAgent,
  streamChunk,
  friendlyMessage,
}: {
  messages: ChatMessage[];
  thinking: boolean;
  reasoningSteps: string[];
  activeAgent: string;
  streamChunk: string;
  friendlyMessage?: string;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col border-slate-800/80 bg-slate-950/65">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">AI Chat Interface</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3">
        <div className="h-full min-h-[220px] overflow-auto rounded-lg border border-slate-800/70 bg-slate-900/50 p-3">
          {messages.map((m) => (
            <div key={m.id} className={['mb-3 flex', m.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}>
              <div className={[
                'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                m.role === 'user'
                  ? 'bg-cyan-500/20 text-cyan-50'
                  : 'bg-violet-500/15 text-slate-100',
              ].join(' ')}>
                <div>{m.text}</div>
                {m.executedBy ? <div className="mt-1 text-[11px] text-cyan-300/80">Agent Execution: {m.executedBy}</div> : null}
              </div>
            </div>
          ))}
          {thinking ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-200">
              <div className="font-medium">AI Thinking...</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-300">
                {reasoningSteps.map((s, idx) => <li key={`${s}_${idx}`}>{s}</li>)}
              </ul>
              <div className="mt-2 text-cyan-300/80">Agent: {activeAgent}</div>
            </div>
          ) : null}
          {friendlyMessage ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
              {friendlyMessage}
            </div>
          ) : null}
          {streamChunk ? (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm text-violet-100">
              <div className="mb-1 text-xs text-violet-300/80">{thinking ? 'Streaming response' : 'Final response'}</div>
              {streamChunk}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
