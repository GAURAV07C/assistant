'use client';

import { motion } from 'framer-motion';

export function VisualHub({ snapshot }: { snapshot: any }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="h-full rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950/60 p-6"
    >
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-slate-400">Visual Intelligence Hub</div>
      <div className="mt-6 grid h-full gap-4 text-sm text-slate-200 md:grid-cols-2">
        {(snapshot?.visuals || ['Mindmap beta']).map((card: string, index: number) => (
          <div
            key={`viz_${index}`}
            className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-white/5 p-4"
          >
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Flowchart {index + 1}</div>
            <div className="mt-6 flex-1 text-sm leading-relaxed">{card}</div>
            <div className="mt-4 text-[0.6rem] text-slate-500">Status: {snapshot?.visualStatus || 'Awaiting agent data'}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
