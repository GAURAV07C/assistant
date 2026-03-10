'use client';

import * as React from 'react';
import { cn } from '../../lib/utils.js';

type AccordionItem = {
  id: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
};

export function AccordionGroup({
  items,
  defaultOpenId,
  className,
}: {
  items: AccordionItem[];
  defaultOpenId?: string;
  className?: string;
}) {
  const [openId, setOpenId] = React.useState<string>(defaultOpenId || '');

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              'overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/65',
              'transition-all duration-300 ease-out hover:border-cyan-500/35 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]',
            )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              onClick={() => setOpenId((prev) => (prev === item.id ? '' : item.id))}
            >
              <div>
                <div className="text-sm font-medium text-slate-100">{item.title}</div>
                {item.subtitle ? <div className="text-xs text-slate-400">{item.subtitle}</div> : null}
              </div>
              <span
                className={cn(
                  'text-cyan-300 transition-transform duration-300',
                  open ? 'rotate-180' : 'rotate-0',
                )}
              >
                ▼
              </span>
            </button>
            <div
              className={cn(
                'grid transition-all duration-300 ease-out',
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-60',
              )}
            >
              <div className="overflow-hidden">
                <div className="animate-in px-3 pb-3 pt-1 duration-300">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
