'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveApiBase } from '@/lib/apiBase';

type UpgradeEntry = {
  proposal_id: string;
  feature: string;
  summary: string;
  sandbox_path?: string;
  tests: { success: boolean; outputs: string[] };
  integrated_at: string;
};

export function SelfUpgradePanel() {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [history, setHistory] = useState<UpgradeEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [featureRequest, setFeatureRequest] = useState('Improve learning engine');
  const [reason, setReason] = useState('Automated dashboard request');
  const [message, setMessage] = useState('');

  const loadHistory = async () => {
    try {
      const resp = await fetch(`${apiBase}/evolution/upgrades`);
      if (!resp.ok) throw new Error('Failed to load upgrades');
      const data = await resp.json();
      setHistory(data.upgrades || []);
    } catch (err) {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const triggerUpgrade = async () => {
    setRunning(true);
    setMessage('');
    try {
      const resp = await fetch(`${apiBase}/agent/self-upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_request: featureRequest,
          reason,
          run_tests: true,
        }),
      });
      if (!resp.ok) throw new Error('Upgrade failed');
      const data = await resp.json();
      setMessage(data.summary || 'Upgrade requested');
    } catch (err) {
      setMessage(String(err));
    } finally {
      setRunning(false);
      loadHistory();
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-2xl shadow-emerald-900/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-emerald-300/80">Self-Modification</p>
          <h3 className="text-lg font-semibold text-white">Upgrade History</h3>
        </div>
        <button
          type="button"
          onClick={triggerUpgrade}
          disabled={running}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-500/60 disabled:opacity-50"
        >
          {running ? 'Upgrading…' : 'Trigger Upgrade'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Runs via sandboxed pipeline and logs results for human review.</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Feature Request
          <input
            type="text"
            value={featureRequest}
            onChange={(e) => setFeatureRequest(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800/80 bg-slate-900/60 px-3 py-1 text-xs outline-none focus:border-emerald-400"
          />
        </label>
        <label className="text-xs text-slate-400">
          Reason
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800/80 bg-slate-900/60 px-3 py-1 text-xs outline-none focus:border-emerald-400"
          />
        </label>
      </div>
      <div className="mt-4 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-slate-800/70 bg-black/30 p-3 text-xs text-slate-300">
        {history.length ? history.map((entry) => (
          <div key={entry.proposal_id} className="space-y-1 rounded-md border border-slate-900/60 bg-slate-900/50 p-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{entry.proposal_id}</span>
              <span className={`rounded-full px-2 py-0.5 ${entry.tests.success ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>{entry.tests.success ? 'pass' : 'fail'}</span>
            </div>
            <p className="text-xs text-slate-200">{entry.feature}</p>
            <p className="text-[11px] text-slate-400">{entry.summary}</p>
          </div>
        )) : <div className="text-center text-xs text-slate-500">No upgrade history yet.</div>}
      </div>
      {message ? <p className="mt-3 text-xs text-emerald-300">{message}</p> : null}
    </section>
  );
}
