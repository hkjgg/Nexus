/**
 * A small, quiet state chip.
 *
 * The tone is the only colour a badge carries, and it maps onto the semantic
 * status tokens, so "critical" looks the same wherever it appears.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'positive' | 'caution' | 'critical' | 'info' | 'accent';

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
  /** Adds a filled dot before the label, for statuses read at a glance. */
  dot?: boolean;
  className?: string;
};

const TONE: Record<StatusTone, { text: string; bg: string; dot: string }> = {
  neutral: { text: 'text-secondary', bg: 'bg-neutral-surface', dot: 'bg-neutral' },
  positive: { text: 'text-positive', bg: 'bg-positive-surface', dot: 'bg-positive' },
  caution: { text: 'text-caution', bg: 'bg-caution-surface', dot: 'bg-caution' },
  critical: { text: 'text-critical', bg: 'bg-critical-surface', dot: 'bg-critical' },
  info: { text: 'text-info', bg: 'bg-info-surface', dot: 'bg-info' },
  accent: { text: 'text-accent', bg: 'bg-accent-surface', dot: 'bg-accent' },
};

export function StatusBadge({ children, tone = 'neutral', dot, className }: StatusBadgeProps) {
  const styles = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
        styles.bg,
        styles.text,
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', styles.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
