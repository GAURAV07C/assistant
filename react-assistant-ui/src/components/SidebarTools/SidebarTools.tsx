'use client';

import { motion } from 'framer-motion';

const tools = [
  'Add Files',
  'Memory',
  'History',
  'User',
  'Knowledge',
  'Agents',
  'Research',
  'Skills',
];

const colors = ['#10b981', '#8b5cf6', '#22d3ee', '#f97316', '#6366f1', '#ec4899', '#0ea5e9', '#a855f7'];

export function SidebarTools() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Tools</div>
      <div className="flex flex-col gap-3">
        {tools.map((tool, index) => (
          <motion.button
            key={tool}
            className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 shadow-[0_20px_45px_rgba(15,23,42,0.4)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl font-bold"
                style={{ background: `${colors[index % colors.length]}22`, color: colors[index % colors.length] }}
              >
                {tool.charAt(0)}
              </span>
              <span>{tool}</span>
            </div>
            <span className="text-xs text-slate-400">→</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
