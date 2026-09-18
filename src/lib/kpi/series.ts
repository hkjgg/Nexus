/**
 * Bucketed KPI history.
 *
 * A thin typed wrapper over the `kpi_series` SQL function (migration 0003).
 * The buckets it returns line up exactly with the totals `kpi_summary`
 * reports for the same window, because both compute the same expressions over
 * the same rows.
 */

import { query } from '@/lib/db/pg';
import type { KpiQuery } from './types';

export type SeriesBucket = 'hour' | 'day';

export type KpiSeriesPoint = {
  /** Start of the bucket, as an instant. */
  bucketStart: Date;
  ordersCount: number;
  deliveredCount: number;
  cancelledCount: number;
  lateCount: number;
  revenue: number;
  totalCost: number;
  profit: number;
  costPerDelivery: number | null;
  onTimeRate: number | null;
  avgDeliveryMinutes: number | null;
  /** Only defined on a daily grid - shifts are recorded per calendar day. */
  fleetUtilization: number | null;
};

export type KpiSeriesQuery = KpiQuery & {
  bucket: SeriesBucket;
  /** IANA zone the buckets are aligned to, e.g. 'Asia/Beirut'. */
  timeZone: string;
};

type SeriesRow = {
  bucket_start: Date;
  orders_count: string;
  delivered_count: string;
  cancelled_count: string;
  late_count: string;
  revenue: string | null;
  total_cost: string | null;
  profit: string | null;
  cost_per_delivery: string | null;
  on_time_rate: string | null;
  avg_delivery_minutes: string | null;
  fleet_utilization: string | null;
};

const num = (value: string | null): number => (value === null ? 0 : Number(value));
const nullableNum = (value: string | null): number | null =>
  value === null ? null : Number(value);

export async function getKpiSeries(params: KpiSeriesQuery): Promise<KpiSeriesPoint[]> {
  const rows = await query<SeriesRow>(
    'select * from kpi_series($1::uuid, $2::timestamptz, $3::timestamptz, $4::text, $5::text, $6::uuid)',
    [
      params.companyId,
      params.from.toISOString(),
      params.to.toISOString(),
      params.bucket,
      params.timeZone,
      params.zoneId ?? null,
    ],
  );

  return rows.map((row) => ({
    bucketStart: new Date(row.bucket_start),
    ordersCount: num(row.orders_count),
    deliveredCount: num(row.delivered_count),
    cancelledCount: num(row.cancelled_count),
    lateCount: num(row.late_count),
    revenue: num(row.revenue),
    totalCost: num(row.total_cost),
    profit: num(row.profit),
    costPerDelivery: nullableNum(row.cost_per_delivery),
    onTimeRate: nullableNum(row.on_time_rate),
    avgDeliveryMinutes: nullableNum(row.avg_delivery_minutes),
    fleetUtilization: nullableNum(row.fleet_utilization),
  }));
}
