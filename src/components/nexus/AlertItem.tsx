/**
 * One row in the alerts panel.
 *
 * An alert earns its place by being specific: which thing, which metric, what
 * the value is and what it should be. The severity is carried by a single left
 * rule and the icon colour - there is no red panel shouting at the operator.
 */

import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import type { AlertSeverity } from '@/lib/alerts/types';
import { cn } from '@/lib/cn';

export type AlertItemProps = {
  severity: AlertSeverity;
  title: string;
  message: string;
  /** What the alert is about, e.g. "Zone Z04" or "Van SP-V03". */
  entityLabel: string;
  /** Formatted metric readout, e.g. "26.4% late vs 8.0% expected". */
  readout?: string;
  /** Rendered as a relative or absolute time; already formatted. */
  timeLabel?: string;
  className?: string;
};

const SEVERITY = {
  critical: { icon: OctagonAlert, text: 'text-critical', rule: 'bg-critical' },
  warning: { icon: AlertTriangle, text: 'text-caution', rule: 'bg-caution' },
  info: { icon: Info, text: 'text-info', rule: 'bg-info' },
} as const;

export function AlertItem({
  severity,
  title,
  message,
  entityLabel,
  readout,
  timeLabel,
  className,
}: AlertItemProps) {
  const { icon: Icon, text, rule } = SEVERITY[severity];

  return (
    <article
      className={cn(
        'hover:bg-raised/50 relative flex gap-3 py-3 pr-3 pl-4 transition-colors',
        className,
      )}
    >
      <span className={cn('absolute top-3 bottom-3 left-0 w-0.5 rounded-full', rule)} aria-hidden />

      <Icon className={cn('mt-0.5 size-4 shrink-0', text)} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-content truncate text-sm font-medium">{title}</h3>
          {timeLabel ? (
            <span className="nx-numeric text-faint shrink-0 text-[0.6875rem]">{timeLabel}</span>
          ) : null}
        </div>

        <p className="text-muted mt-1 text-xs leading-relaxed">{message}</p>

        <div className="text-faint mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem]">
          <span className="nx-numeric">{entityLabel}</span>
          {readout ? (
            <>
              <span aria-hidden>&middot;</span>
              <span className="nx-numeric">{readout}</span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
