'use client';

import { useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export type MemoryEntry = {
  id: string;
  type: 'short_term' | 'long_term' | 'vector' | 'knowledge_graph';
  title: string;
  content: string;
  relationships?: string[];
};

export function MemoryViewer({ entries }: { entries: MemoryEntry[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => (`${e.title} ${e.content} ${(e.relationships || []).join(' ')}`).toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <div className="space-y-3">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memory, nodes, links..." />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {filtered.map((entry) => (
          <details key={entry.id} className="group rounded-xl border border-slate-800/80 bg-slate-950/65 p-3">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-100">
              {entry.title}
              <span className="ml-2 text-xs uppercase tracking-[0.16em] text-cyan-300/70">{entry.type}</span>
            </summary>
            <Card className="mt-3 border-slate-700/70 bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.14em] text-slate-300">Memory Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-300">
                <p>{entry.content}</p>
                {(entry.relationships || []).length ? (
                  <div>
                    <div className="mb-1 text-slate-400">Relationships</div>
                    <div className="flex flex-wrap gap-1">
                      {entry.relationships?.map((r) => (
                        <span key={r} className="rounded bg-cyan-500/10 px-2 py-1 text-cyan-200/80">{r}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </details>
        ))}
      </div>
    </div>
  );
}
