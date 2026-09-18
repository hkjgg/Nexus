import { KpiTile, Reveal } from '@/components/nexus';
import {
  KPI_META,
  formatDelta,
  formatKpi,
  percentChange,
  type KpiComparison,
  type KpiKey,
  type SeriesPoint,
} from '@/lib/kpi';

/**
 * The eight figures the control tower leads with, in the order an operator
 * reads them: what came in, what went out, how well it went, what it cost,
 * and what was left.
 *
 * Each one is paired with the series it is the total of, so the tile's
 * sparkline and the chart below it can never disagree.
 */
const TILES: readonly { key: KpiKey; trend: (point: SeriesPoint) => number | null }[] = [
  { key: 'revenue', trend: (point) => point.revenue },
  { key: 'ordersCount', trend: (point) => point.ordersCount },
  { key: 'deliveredCount', trend: (point) => point.deliveredCount },
  { key: 'onTimeRate', trend: (point) => point.onTimeRate },
  { key: 'avgDeliveryMinutes', trend: (point) => point.avgDeliveryMinutes },
  { key: 'fleetUtilization', trend: (point) => point.fleetUtilization },
  { key: 'costPerDelivery', trend: (point) => point.costPerDelivery },
  { key: 'profit', trend: (point) => point.profit },
];

type KpiGridProps = {
  comparison: KpiComparison;
  series: readonly SeriesPoint[];
  currency: string;
  /** e.g. "vs previous 7 days". */
  comparisonLabel: string;
};

export function KpiGrid({ comparison, series, currency, comparisonLabel }: KpiGridProps) {
  const { current, previous } = comparison;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {TILES.map((tile, index) => {
        const meta = KPI_META[tile.key];

        // Some metrics have no value in some buckets - utilisation across an
        // hourly range, or the day that is still running. A line is drawn only
        // when most of the period actually reported, so a sparkline is never
        // three points pretending to be a trend.
        const trend = series
          .map(tile.trend)
          .filter((value): value is number => value !== null && Number.isFinite(value));
        const hasTrend = trend.length >= 3 && trend.length * 2 >= series.length;

        return (
          <Reveal key={tile.key} index={index}>
            <KpiTile
              label={meta.label}
              value={formatKpi(current[tile.key], meta.format, { currency })}
              delta={percentChange(current[tile.key], previous[tile.key])}
              deltaLabel={formatDelta(percentChange(current[tile.key], previous[tile.key]))}
              higherIsBetter={meta.higherIsBetter}
              comparisonLabel={comparisonLabel}
              trend={hasTrend ? trend : undefined}
            />
          </Reveal>
        );
      })}
    </div>
  );
}
