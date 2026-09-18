import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { Sparkline } from './sparkline';

type KpiTileProps = {
  label: string;
  /** Already formatted for the company's currency and locale. */
  value: string;
  /** Fractional change against the previous period, or null with no baseline. */
  delta: number | null;
  /** Decides whether a rise is painted good or critical. */
  higherIsBetter: boolean;
  /** Formatted delta, e.g. "+4.2%". */
  deltaLabel: string;
  /** Wording for the comparison, e.g. "vs previous 7 days". */
  comparisonLabel: string;
  /** Daily values across the current period, oldest first. */
  trend?: readonly number[];
  className?: string;
};

/**
 * One headline figure, its movement against the period before it, and the
 * shape of how it got there.
 *
 * The value is mono and tabular so a row of tiles lines up; the delta is the
 * only coloured thing, and it carries an arrow so direction survives without
 * colour.
 */
export function KpiTile({
  label,
  value,
  delta,
  higherIsBetter,
  deltaLabel,
  comparisonLabel,
  trend,
  className,
}: KpiTileProps) {
  // A delta of exactly zero is movement-free, not good and not bad.
  const direction = delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  const improved = direction === 'flat' ? null : (direction === 'up') === higherIsBetter;

  const deltaTone = improved === null ? 'text-ink-faint' : improved ? 'text-good' : 'text-critical';

  const DeltaIcon =
    direction === 'flat' ? ArrowRight : direction === 'up' ? ArrowUpRight : ArrowDownRight;

  const sparkStroke =
    improved === null
      ? 'var(--color-ink-faint)'
      : improved
        ? 'var(--color-good)'
        : 'var(--color-critical)';

  return (
    <div
      className={cn(
        'border-line bg-surface hover:border-line-strong rounded-lg border p-4',
        'transition-colors duration-200',
        className,
      )}
    >
      <p className="text-ink-muted truncate text-xs" title={label}>
        {label}
      </p>

      <p className="text-ink mt-2 font-mono text-2xl leading-none font-medium tracking-tight">
        {value}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('flex items-center gap-1 text-xs font-medium', deltaTone)}>
            <DeltaIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="font-mono">{deltaLabel}</span>
          </p>
          <p className="text-ink-faint mt-0.5 truncate text-[0.68rem]">{comparisonLabel}</p>
        </div>

        {trend && trend.length > 1 ? (
          <Sparkline
            points={trend}
            stroke={sparkStroke}
            label={`${label} trend across the selected period`}
            className="shrink-0"
          />
        ) : null}
      </div>
    </div>
  );
}
