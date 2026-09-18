import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/ui/cn';
import { StatusBadge, type StatusTone } from './status-badge';

export type AlertSeverity = 'info' | 'warning' | 'critical';

const SEVERITY: Record<
  AlertSeverity,
  { tone: StatusTone; label: string; icon: ComponentType<{ className?: string }>; rule: string }
> = {
  info: { tone: 'accent', label: 'Info', icon: Info, rule: 'bg-accent' },
  warning: { tone: 'warn', label: 'Warning', icon: AlertTriangle, rule: 'bg-warn' },
  critical: { tone: 'critical', label: 'Critical', icon: OctagonAlert, rule: 'bg-critical' },
};

type AlertItemProps = {
  severity: AlertSeverity;
  title: string;
  /** One or two sentences: what happened, and what it implies. */
  message: string;
  /** The entity it concerns, e.g. "Zone Z04" or "Van SP-V03". */
  subject?: string;
  /** The measurement behind the rule, already formatted. */
  evidence?: string;
  className?: string;
};

/**
 * One finding from the rule engine.
 *
 * Severity is carried three ways - an icon, a written label and a colour - so
 * it survives colourblindness, a greyscale print and a glance from across the
 * room.
 */
export function AlertItem({
  severity,
  title,
  message,
  subject,
  evidence,
  className,
}: AlertItemProps) {
  const config = SEVERITY[severity];
  const Icon = config.icon;

  return (
    <article className={cn('hover:bg-raised relative flex gap-3 p-3 transition-colors', className)}>
      <span className={cn('absolute inset-y-0 left-0 w-0.5', config.rule)} aria-hidden />

      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          severity === 'critical'
            ? 'text-critical'
            : severity === 'warning'
              ? 'text-warn'
              : 'text-accent',
        )}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ink text-sm font-medium">{title}</h3>
          <StatusBadge tone={config.tone} showDot={false}>
            {config.label}
          </StatusBadge>
          {subject ? (
            <span className="text-ink-faint font-mono text-[0.68rem]">{subject}</span>
          ) : null}
        </div>

        <p className="text-ink-muted mt-1 text-xs leading-relaxed">{message}</p>

        {evidence ? (
          <p className="text-ink-faint mt-1.5 font-mono text-[0.68rem]">{evidence}</p>
        ) : null}
      </div>
    </article>
  );
}
