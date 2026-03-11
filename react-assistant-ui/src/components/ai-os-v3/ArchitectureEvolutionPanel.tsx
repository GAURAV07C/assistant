'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveApiBase } from '@/lib/apiBase';

type Proposal = {
  id: string;
  problem: string;
  solution: string;
  priority: string;
  status: string;
};

export function ArchitectureEvolutionPanel() {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  const loadProposals = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBase}/architecture/proposals`);
      if (!resp.ok) throw new Error('Unable to fetch proposals');
      const data = await resp.json();
      setProposals(data.proposals || []);
    } catch (err) {
      setMessage(String(err));
    }
  }, []);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const triggerRefactor = useCallback(async () => {
    setRunning(true);
    setMessage('');
    try {
      const resp = await fetch(`${apiBase}/agent/architecture/refactor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detail: 'Autonomous scan for architecture improvements' }),
      });
      if (!resp.ok) throw new Error('Refactor request failed');
      const data = await resp.json();
      setMessage(data.summary || 'Refactor triggered');
    } catch (err) {
      setMessage(String(err));
    } finally {
      setRunning(false);
      loadProposals();
    }
  }, [loadProposals]);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-2xl shadow-violet-900/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-violet-300/80">Architecture Evolution</p>
          <h3 className="text-lg font-semibold text-white">Refactor Proposals</h3>
        </div>
        <button
          type="button"
          onClick={triggerRefactor}
          disabled={running}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-violet-500/60 disabled:opacity-50"
        >
          {running ? 'Analyzing…' : 'Run Refactor'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Proposals blend analyzer metrics with sandbox validations.</p>
      <div className="mt-4 space-y-3">
        {proposals.length ? proposals.map((proposal) => (
          <div key={proposal.id} className="rounded-xl border border-slate-800/80 bg-black/40 p-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Priority: {proposal.priority}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${proposal.status === 'validated' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-200'}`}>{proposal.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-200">{proposal.problem}</p>
            <p className="text-xs text-slate-500">{proposal.solution}</p>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 p-3 text-xs text-slate-400">No proposals yet. Run analysis to generate one.</div>
        )}
      </div>
      {message ? <p className="mt-3 text-xs text-emerald-300">{message}</p> : null}
    </section>
  );
}
