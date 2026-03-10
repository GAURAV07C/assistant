'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';

export function AIBrain({
  mode,
  agentsRunning,
  tasksCompleted,
  memorySize,
  onInitialize,
}: {
  mode: string;
  agentsRunning: number;
  tasksCompleted: number;
  memorySize: string;
  onInitialize: () => void;
}) {
  const controls = useAnimation();

  useEffect(() => {
    controls.start({ scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9], transition: { repeat: Infinity, duration: 4 } });
  }, [controls]);

  useEffect(() => {
    const utter = new SpeechSynthesisUtterance(`AI mode is ${mode}.`);
    utter.lang = 'en-US';
    utter.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [mode]);

  return (
    <div className="flex w-full flex-col gap-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-6 shadow-[0_35px_60px_rgba(15,23,42,0.45)]">
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">AI Core</div>
      <motion.div
        animate={controls}
        className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full bg-cyan-500/10 shadow-[0_25px_45px_rgba(14,165,233,0.4)]"
      >
        <div className="absolute h-48 w-48 animate-spin rounded-full border border-t-cyan-400/60 border-slate-800"></div>
        <div className="h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/50 to-purple-500/50 p-px">
          <div className="h-full w-full rounded-full bg-gradient-to-br from-slate-950/80 to-slate-900/80 blur-0" />
        </div>
      </motion.div>
      <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
        <div className="rounded-2xl border border-slate-800 bg-white/5 p-3">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">System Mode</div>
          <div className="mt-2 text-sm font-semibold text-cyan-300">{mode}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-white/5 p-3">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">Agents Running</div>
          <div className="mt-2 text-sm font-semibold text-emerald-300">{agentsRunning}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-white/5 p-3">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">Tasks Completed</div>
          <div className="mt-2 text-sm font-semibold text-indigo-300">{tasksCompleted}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-white/5 p-3">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">Memory Size</div>
          <div className="mt-2 text-sm font-semibold text-amber-300">{memorySize}</div>
        </div>
      </div>
      <motion.button
        onClick={() => {
          onInitialize();
          const utter = new SpeechSynthesisUtterance('Initializing assistant.');
          utter.lang = 'en-US';
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="self-center rounded-full border border-cyan-500 px-8 py-3 text-sm font-semibold uppercase tracking-[0.5em] text-cyan-100"
      >
        Initialize AI
      </motion.button>
    </div>
  );
}
