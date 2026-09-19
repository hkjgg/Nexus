/**
 * One headline metric: value, label, change against the previous period and a
 * sparkline of how it got there.
 *
 * The tile never decides whether a number is good. `higherIsBetter` comes from
 * KPI_META, so "cost per delivery fell 4%" is green and "delivery time rose
 * 4%" is red without the component knowing what either metric means.
 */

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sparkline } from './Sparkline';

export type KpiTileProps = {
  label: string;
  /** Already formatted for display - the tile does no number formatting. */
  value: string;
  /** Fractional change against the previous period, e.g. 0.042 for +4.2%. */
  change: number | null;
  /** Formatted change, e.g. "+4.2%". */
  changeLabel: string;
  /** Whether a rise in this metric is an improvement. */
  higherIsBetter: boolean;
  /** What the change is measured against, e.g. "vs previous 7 days". */
  comparisonLabel: string;
  /** One point per day over the selected range, oldest first. */
  series?: readonly (number | null)[];
  className?: string;
};

export function KpiTile({
  label,
  value,
  change,
  changeLabel,
  higherIsBetter,
  comparisonLabel,
  series,
  className,
}: KpiTileProps) {
  const flat = change === null || change === 0;
  const improved = flat ? null : higherIsBetter === change > 0;

  const deltaClass = flat ? 'text-faint' : improved ? 'text-positive' : 'text-critical';
  const DeltaIcon = flat ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        'bg-surface rounded-nx border-line-subtle hover:border-line group relative border p-4 transition-colors',
        className,
      )}
    >
      <p className="text-muted truncate text-xs font-medium">{label}</p>

      <p className="nx-numeric text-content mt-2 text-2xl leading-none font-semibold">{value}</p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('nx-numeric flex items-center gap-1 text-xs font-medium', deltaClass)}>
            <DeltaIcon className="size-3 shrink-0" aria-hidden />
            {changeLabel}
          </p>
          <p className="text-faint mt-0.5 truncate text-[0.6875rem]">{comparisonLabel}</p>
        </div>

        {series && series.length > 1 ? (
          <Sparkline
            values={series}
            tone={improved === null ? 'neutral' : improved ? 'positive' : 'critical'}
            className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
          />
        ) : null}
      </div>
    </div>
  );
}
