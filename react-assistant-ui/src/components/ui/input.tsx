import * as React from 'react';

import { cn } from '../../lib/utils.js';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-slate-700/60 bg-slate-950/40 px-3 py-1 text-sm text-slate-100 shadow-sm',
        'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 ring-offset-slate-950',
        className,
      )}
      {...props}
    />
  );
});
