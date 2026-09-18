import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

/**
 * `neutral` is the resting state; `accent` marks something selected rather
 * than something healthy. The three semantic tones are reserved for state
 * and are never used decoratively.
 */
export type StatusTone = 'neutral' | 'accent' | 'good' | 'warn' | 'critical';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-line text-ink-muted bg-inset',
  accent: 'border-accent/40 text-accent-strong bg-accent-wash',
  good: 'border-good/40 text-good bg-good-wash',
  warn: 'border-warn/40 text-warn bg-warn-wash',
  critical: 'border-critical/50 text-critical bg-critical-wash',
};

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-ink-faint',
  accent: 'bg-accent',
  good: 'bg-good',
  warn: 'bg-warn',
  critical: 'bg-critical',
};

type StatusBadgeProps = {
  tone: StatusTone;
  /** Always present: the colour never carries the meaning on its own. */
  children: ReactNode;
  /** Hidden when an icon already sits beside the badge. */
  showDot?: boolean;
  className?: string;
};

export function StatusBadge({ tone, children, showDot = true, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5',
        'text-[0.68rem] font-medium tracking-wide whitespace-nowrap uppercase',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {showDot ? (
        <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
