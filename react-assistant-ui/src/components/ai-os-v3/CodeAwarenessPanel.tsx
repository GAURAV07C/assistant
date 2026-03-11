'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiBase } from '@/lib/apiBase';

interface FeatureList {
  implemented: string[];
  missing: string[];
}

interface ModuleSummary {
  module: string;
  summary: string;
}

export function CodeAwarenessPanel() {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [mapData, setMapData] = useState<any>(null);
  const [features, setFeatures] = useState<FeatureList>({ implemented: [], missing: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounce = useRef<NodeJS.Timeout>();

  const fetchMap = async () => {
    setLoading(true);
    setError('');
    try {
      const [mapResp, featureResp] = await Promise.all([
        fetch(`${apiBase}/codebase/map`),
        fetch(`${apiBase}/codebase/features`),
      ]);
      if (!mapResp.ok) throw new Error('Failed to load code map');
      if (!featureResp.ok) throw new Error('Failed to load features');
      const mapJson = await mapResp.json();
      const featureJson = await featureResp.json();
      setMapData(mapJson.map);
      setFeatures(featureJson.features || { implemented: [], missing: [] });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMap();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const resp = await fetch(`${apiBase}/codebase/search?q=${encodeURIComponent(searchTerm)}`);
        if (!resp.ok) throw new Error('Search failed');
        const data = await resp.json();
        setSearchResults(data.results || []);
      } catch (err) {
        setSearchResults([]);
      }
    }, 420);
  }, [searchTerm]);

  const moduleCount = useMemo(() => mapData?.modules?.length ?? 0, [mapData]);
  const dependencyCount = useMemo(() => mapData?.graph?.edges?.length ?? 0, [mapData]);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-2xl shadow-cyan-900/20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase text-cyan-300/80">Code Awareness</p>
          <h3 className="text-lg font-semibold text-white">Self Code Knowledge</h3>
        </div>
        <button
          type="button"
          onClick={fetchMap}
          disabled={loading}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-500/60 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-black/30 p-3 text-sm text-slate-300">
          <div className="text-xs text-slate-400">Modules</div>
          <div className="text-2xl font-bold text-cyan-300">{moduleCount}</div>
          <p className="text-xs text-slate-500">{dependencyCount} dependency edges</p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-black/30 p-3 text-sm text-slate-300">
          <div className="text-xs text-slate-400">Features</div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-emerald-300">{features.implemented.length}</span>
            <span className="text-xs text-slate-400">implemented</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-rose-300">{features.missing.length}</span>
            <span className="text-xs text-slate-400">gaps</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="rounded-lg border border-slate-800/80 bg-black/30 p-3 text-sm text-slate-300">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search module, feature, or route…"
            className="w-full rounded-md border border-slate-800 bg-slate-900/50 p-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
          />
        </div>
        {error ? <div className="text-xs text-rose-300">{error}</div> : null}
        {searchResults.length ? (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-black/30 p-3 text-xs text-slate-300">
            {searchResults.map((result) => (
              <div key={result.module} className="space-y-1 rounded-md border border-slate-900/70 bg-slate-900/60 p-2">
                <p className="text-xs text-slate-400">{result.module}</p>
                <p className="text-sm text-slate-200">{result.summary}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase text-slate-400">Implemented Features</p>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
            {features.implemented.slice(0, 4).map((feature) => <li key={`impl_${feature}`}>• {feature}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">Missing Gaps</p>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
            {features.missing.slice(0, 4).map((feature) => <li key={`miss_${feature}`}>• {feature || '—'}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
