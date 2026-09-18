/**
 * Typed KPI queries.
 *
 * Each function is a thin, typed wrapper over the `kpi_summary` SQL function,
 * so the arithmetic lives in the database and TypeScript only maps and
 * formats. Every metric accepts a date range and an optional zone.
 */

import { query } from '@/lib/db/pg';
import type { DateRange, KpiComparison, KpiQuery, KpiSummary } from './types';

/** Raw shape returned by the SQL function; all numerics arrive as strings. */
type KpiRow = {
  orders_count: string;
  delivered_count: string;
  cancelled_count: string;
  failed_count: string;
  late_count: string;
  revenue: string | null;
  total_cost: string | null;
  profit: string | null;
  cost_per_delivery: string | null;
  success_rate: string | null;
  on_time_rate: string | null;
  delay_rate: string | null;
  cancellation_rate: string | null;
  avg_delivery_minutes: string | null;
  fleet_utilization: string | null;
};

const toNumber = (value: string | null): number => (value === null ? 0 : Number(value));
const toNullableNumber = (value: string | null): number | null =>
  value === null ? null : Number(value);

function mapRow(row: KpiRow): KpiSummary {
  return {
    ordersCount: toNumber(row.orders_count),
    deliveredCount: toNumber(row.delivered_count),
    cancelledCount: toNumber(row.cancelled_count),
    failedCount: toNumber(row.failed_count),
    lateCount: toNumber(row.late_count),
    revenue: toNumber(row.revenue),
    totalCost: toNumber(row.total_cost),
    profit: toNumber(row.profit),
    costPerDelivery: toNullableNumber(row.cost_per_delivery),
    successRate: toNullableNumber(row.success_rate),
    onTimeRate: toNullableNumber(row.on_time_rate),
    lateRate: toNullableNumber(row.delay_rate),
    cancellationRate: toNullableNumber(row.cancellation_rate),
    avgDeliveryMinutes: toNullableNumber(row.avg_delivery_minutes),
    fleetUtilization: toNullableNumber(row.fleet_utilization),
  };
}

/** An empty result, used when the range contains no rows at all. */
const EMPTY: KpiSummary = {
  ordersCount: 0,
  deliveredCount: 0,
  cancelledCount: 0,
  failedCount: 0,
  lateCount: 0,
  revenue: 0,
  totalCost: 0,
  profit: 0,
  costPerDelivery: null,
  successRate: null,
  onTimeRate: null,
  lateRate: null,
  cancellationRate: null,
  avgDeliveryMinutes: null,
  fleetUtilization: null,
};

/** All ten headline KPIs for one range, in a single round trip. */
export async function getKpiSummary(params: KpiQuery): Promise<KpiSummary> {
  const rows = await query<KpiRow>(
    'select * from kpi_summary($1::uuid, $2::timestamptz, $3::timestamptz, $4::uuid)',
    [params.companyId, params.from.toISOString(), params.to.toISOString(), params.zoneId ?? null],
  );
  const row = rows[0];
  return row ? mapRow(row) : { ...EMPTY };
}

/**
 * The same range compared against the period immediately before it, of equal
 * length. This is what drives every "vs previous period" delta in the UI.
 */
export async function getKpiComparison(params: KpiQuery): Promise<KpiComparison> {
  const spanMs = params.to.getTime() - params.from.getTime();
  const previous: KpiQuery = {
    ...params,
    from: new Date(params.from.getTime() - spanMs),
    to: params.from,
  };

  const [current, prior] = await Promise.all([getKpiSummary(params), getKpiSummary(previous)]);

  return { current, previous: prior };
}

/**
 * Percentage change between two values, or null when there is no meaningful
 * baseline (a previous value of zero or a missing metric).
 */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** The trailing `days`-day window ending now. */
export function lastNDays(days: number, now: Date = new Date()): DateRange {
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}

/** The `days`-day window immediately before `range`. */
export function precedingWindow(range: DateRange): DateRange {
  const spanMs = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - spanMs), to: range.from };
}

// ---------------------------------------------------------------------------
// Individual metric accessors
//
// The dashboard usually wants the whole summary, but the AI layer and ad-hoc
// analysis often want a single number. These read from the same SQL function,
// so they can never drift from the headline figures.
// ---------------------------------------------------------------------------

const single =
  <K extends keyof KpiSummary>(key: K) =>
  async (params: KpiQuery): Promise<KpiSummary[K]> =>
    (await getKpiSummary(params))[key];

export const getRevenue = single('revenue');
export const getOrdersCount = single('ordersCount');
export const getDeliverySuccessRate = single('successRate');
export const getOnTimeRate = single('onTimeRate');
export const getAvgDeliveryMinutes = single('avgDeliveryMinutes');
export const getFleetUtilization = single('fleetUtilization');
export const getCostPerDelivery = single('costPerDelivery');
export const getProfit = single('profit');
export const getDelayRate = single('lateRate');
export const getCancellationRate = single('cancellationRate');
