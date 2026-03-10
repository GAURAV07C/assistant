import * as React from 'react';
import { cn } from '../../lib/utils.js';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm',
        'backdrop-blur supports-[backdrop-filter]:bg-card/70',
        'transition-transform will-change-transform hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HeadingProps) {
  return <h3 className={cn('text-sm font-semibold tracking-wide text-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}
