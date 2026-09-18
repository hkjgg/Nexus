/**
 * Per-zone performance.
 *
 * Wraps the `zone_performance` SQL function (migration 0003), which returns
 * one row per zone whether or not it saw traffic, along with the zone geometry
 * so the mini-map and the zone table are fed by a single round trip and can
 * never disagree about which zone is struggling.
 */

import { query } from '@/lib/db/pg';
import type { GeoJsonPolygon } from '@/lib/db/types';
import type { DateRange } from './types';

export type ZonePerformance = {
  zoneId: string;
  code: string;
  name: string;
  centerLat: number;
  centerLng: number;
  polygon: GeoJsonPolygon;
  ordersCount: number;
  deliveredCount: number;
  lateCount: number;
  onTimeRate: number | null;
  avgDeliveryMinutes: number | null;
  revenue: number;
  driverCount: number;
  /** Orders in the range per driver based in the zone. */
  ordersPerDriver: number | null;
};

type ZoneRow = {
  zone_id: string;
  zone_code: string;
  zone_name: string;
  center_lat: number;
  center_lng: number;
  polygon: GeoJsonPolygon;
  orders_count: string;
  delivered_count: string;
  late_count: string;
  on_time_rate: string | null;
  avg_delivery_minutes: string | null;
  revenue: string | null;
  driver_count: string;
  orders_per_driver: string | null;
};

export async function getZonePerformance(
  companyId: string,
  range: DateRange,
): Promise<ZonePerformance[]> {
  const rows = await query<ZoneRow>(
    'select * from zone_performance($1::uuid, $2::timestamptz, $3::timestamptz)',
    [companyId, range.from.toISOString(), range.to.toISOString()],
  );

  return rows.map((row) => ({
    zoneId: row.zone_id,
    code: row.zone_code,
    name: row.zone_name,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    polygon: row.polygon,
    ordersCount: Number(row.orders_count),
    deliveredCount: Number(row.delivered_count),
    lateCount: Number(row.late_count),
    onTimeRate: row.on_time_rate === null ? null : Number(row.on_time_rate),
    avgDeliveryMinutes: row.avg_delivery_minutes === null ? null : Number(row.avg_delivery_minutes),
    revenue: row.revenue === null ? 0 : Number(row.revenue),
    driverCount: Number(row.driver_count),
    ordersPerDriver: row.orders_per_driver === null ? null : Number(row.orders_per_driver),
  }));
}
