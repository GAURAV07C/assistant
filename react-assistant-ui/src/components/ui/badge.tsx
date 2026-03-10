import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        cyan: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100',
        danger: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  className?: string;
  variant?: 'default' | 'outline' | 'cyan' | 'danger';
};

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
