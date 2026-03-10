'use client';

export function SystemConsole({ logs }: { logs: Array<{ label: string; detail: string }> }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-slate-400">System Console</div>
      <div className="mt-3 space-y-2 text-[0.75rem]">
        {logs.map((log) => (
          <div key={log.label + log.detail} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-white/5 px-3 py-2">
            <span className="text-[0.55rem] uppercase tracking-[0.4em] text-slate-500">{log.label}</span>
            <span className="flex-1 border-l border-slate-800 pl-3 text-[0.7rem] text-slate-300">{log.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
