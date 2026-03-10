import * as React from 'react';

import { cn } from '../../lib/utils.js';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[120px] w-full rounded-md border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 shadow-sm',
        'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 ring-offset-slate-950',
        className,
      )}
      {...props}
    />
  );
});
