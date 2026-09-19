/**
 * The surface every panel in NEXUS sits on.
 *
 * One border, one background layer, one radius - so panels read as a single
 * system rather than eight slightly different boxes.
 */

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Removes the inner padding, for a card whose child manages its own (tables, maps). */
  flush?: boolean;
  /** Emphasises the border, for the one panel that needs to be noticed. */
  tone?: 'default' | 'critical' | 'caution';
};

const TONE_BORDER: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'border-line-subtle',
  critical: 'border-critical/40',
  caution: 'border-caution/40',
};

export function Card({ className, flush, tone = 'default', children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-nx border',
        TONE_BORDER[tone],
        flush ? 'overflow-hidden' : 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
