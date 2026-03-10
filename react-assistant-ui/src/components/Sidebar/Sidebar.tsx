'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Chat', href: '/chat' },
  { label: 'Agents', href: '/agents' },
  { label: 'Memory', href: '/memory' },
  { label: 'Skills', href: '/skills' },
  { label: 'Research', href: '/research' },
  { label: 'System', href: '/system' },
  { label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-full rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-[0_0_40px_rgba(59,130,246,0.08)]">
      <div className="mb-6 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">AI Operating System</div>
        <div className="mt-1 text-lg font-semibold text-slate-100">AI_OS_V3</div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-cyan-500/20 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100',
              ].join(' ')}
            >
              <span>{item.label}</span>
              <span className={active ? 'text-cyan-200' : 'text-slate-500'}>•</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
