/**
 * The eight headline tiles.
 *
 * Every value, delta and sparkline point comes from the KPI layer, which reads
 * SQL: there is no arithmetic in this file beyond picking the right series out
 * of the buckets, and no number is written here.
 */

import { KpiTile } from '@/components/nexus';
import {
  COMMAND_CENTER_KPIS,
  KPI_META,
  formatDelta,
  formatKpi,
  percentChange,
  type KpiComparison,
  type KpiKey,
  type KpiSeriesPoint,
} from '@/lib/kpi';

export type KpiGridProps = {
  comparison: KpiComparison;
  series: readonly KpiSeriesPoint[];
  currency: string;
  comparisonLabel: string;
};

/** Pulls one metric out of every bucket, for the tile's sparkline. */
function seriesFor(key: KpiKey, points: readonly KpiSeriesPoint[]): (number | null)[] | undefined {
  switch (key) {
    case 'revenue':
      return points.map((p) => p.revenue);
    case 'ordersCount':
      return points.map((p) => p.ordersCount);
    case 'deliveredCount':
      return points.map((p) => p.deliveredCount);
    case 'onTimeRate':
      return points.map((p) => p.onTimeRate);
    case 'avgDeliveryMinutes':
      return points.map((p) => p.avgDeliveryMinutes);
    case 'fleetUtilization':
      return points.map((p) => p.fleetUtilization);
    case 'costPerDelivery':
      return points.map((p) => p.costPerDelivery);
    case 'profit':
      return points.map((p) => p.profit);
    default:
      // Metrics without a per-bucket equivalent simply get no sparkline.
      return undefined;
  }
}

export function KpiGrid({ comparison, series, currency, comparisonLabel }: KpiGridProps) {
  const { current, previous } = comparison;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {COMMAND_CENTER_KPIS.map((key) => {
        const meta = KPI_META[key];
        const change = percentChange(current[key], previous[key]);
        const points = seriesFor(key, series);

        return (
          <KpiTile
            key={key}
            label={meta.label}
            value={formatKpi(current[key], meta.format, { currency })}
            change={change}
            changeLabel={formatDelta(change)}
            higherIsBetter={meta.higherIsBetter}
            comparisonLabel={comparisonLabel}
            // A single bucket is a dot, not a trend; the tile skips it.
            series={points && points.length > 1 ? points : undefined}
          />
        );
      })}
    </div>
  );
}
