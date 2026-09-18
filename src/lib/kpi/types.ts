/**
 * The KPI contract.
 *
 * Every figure here is computed in SQL by `kpi_summary` (migration 0002) and
 * is fully deterministic: the same rows and the same range always give the
 * same numbers. No AI, no estimation, no sampling.
 */

/** Half-open range: `from` is included, `to` is excluded. */
export type DateRange = {
  from: Date;
  to: Date;
};

export type KpiQuery = DateRange & {
  companyId: string;
  /** Restricts every metric to one zone. Omit for company-wide figures. */
  zoneId?: string | null;
};

export type KpiSummary = {
  /** Orders placed in the range. */
  ordersCount: number;
  deliveredCount: number;
  cancelledCount: number;
  failedCount: number;
  /** Delivered past the promise, plus orders currently flagged as delayed. */
  lateCount: number;

  /** Delivery fees on delivered orders. */
  revenue: number;
  /** All expenses in the range, pro-rated by delivered volume when zoned. */
  totalCost: number;
  profit: number;
  /** Null when nothing was delivered in the range. */
  costPerDelivery: number | null;

  /** delivered / (delivered + failed + cancelled). Null when none terminal. */
  successRate: number | null;
  /** On-time deliveries / deliveries that carried a promise. */
  onTimeRate: number | null;
  lateRate: number | null;
  cancellationRate: number | null;
  /** Mean minutes from picked_up_at to delivered_at. */
  avgDeliveryMinutes: number | null;
  /** active_minutes / (active_minutes + idle_minutes) across shifts. */
  fleetUtilization: number | null;
};

/** A metric alongside the same metric over the preceding period. */
export type KpiComparison = {
  current: KpiSummary;
  previous: KpiSummary;
};

/** Every metric the KPI layer exposes for presentation. */
export const KPI_KEYS = [
  'revenue',
  'ordersCount',
  'deliveredCount',
  'successRate',
  'onTimeRate',
  'avgDeliveryMinutes',
  'fleetUtilization',
  'costPerDelivery',
  'profit',
  'lateRate',
  'cancellationRate',
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

export type KpiFormat = 'currency' | 'integer' | 'percent' | 'minutes';

/** Presentation metadata. Labels and units live here, never in a component. */
export const KPI_META: Record<
  KpiKey,
  { label: string; format: KpiFormat; higherIsBetter: boolean }
> = {
  revenue: { label: 'Revenue', format: 'currency', higherIsBetter: true },
  ordersCount: { label: 'Orders', format: 'integer', higherIsBetter: true },
  deliveredCount: { label: 'Delivered', format: 'integer', higherIsBetter: true },
  successRate: { label: 'Delivery success rate', format: 'percent', higherIsBetter: true },
  onTimeRate: { label: 'On-time rate', format: 'percent', higherIsBetter: true },
  avgDeliveryMinutes: { label: 'Avg delivery time', format: 'minutes', higherIsBetter: false },
  fleetUtilization: { label: 'Fleet utilisation', format: 'percent', higherIsBetter: true },
  costPerDelivery: { label: 'Cost per delivery', format: 'currency', higherIsBetter: false },
  profit: { label: 'Profit', format: 'currency', higherIsBetter: true },
  lateRate: { label: 'Delay rate', format: 'percent', higherIsBetter: false },
  cancellationRate: { label: 'Cancellation rate', format: 'percent', higherIsBetter: false },
};

/**
 * The eight tiles across the top of the Command Center, in reading order.
 *
 * Volume first, then quality, then money - the order an operations lead asks
 * the questions in.
 */
export const COMMAND_CENTER_KPIS: readonly KpiKey[] = [
  'revenue',
  'ordersCount',
  'deliveredCount',
  'onTimeRate',
  'avgDeliveryMinutes',
  'fleetUtilization',
  'costPerDelivery',
  'profit',
];
