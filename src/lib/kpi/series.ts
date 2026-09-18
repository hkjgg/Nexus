/**
 * Time series and per-zone breakdowns.
 *
 * `kpi_summary` answers "how are we doing over this range". These answer
 * "how did it move" and "where is it coming from", which is what the control
 * tower charts and the zone table need. Same rules as the rest of the KPI
 * layer: the arithmetic happens in SQL, TypeScript only maps and formats.
 */

import { query } from '@/lib/db/pg';
import type { KpiQuery } from './types';

/**
 * Buckets are chosen from the length of the range, not by the caller: a
 * single-day range bucketed daily would draw a chart with one point, and a
 * 90-day range bucketed hourly would draw 2,160.
 */
export type TimeBucket = 'hour' | 'day';

export function bucketForRange(from: Date, to: Date): TimeBucket {
  const hours = (to.getTime() - from.getTime()) / 3_600_000;
  return hours <= 48 ? 'hour' : 'day';
}

export type SeriesPoint = {
  /** Start of the bucket, in the company's timezone. */
  bucketStart: Date;
  ordersCount: number;
  deliveredCount: number;
  /** Null when nothing in the bucket carried a promised time. */
  onTimeRate: number | null;
  revenue: number;
};

type SeriesRow = {
  bucket_start: Date;
  orders_count: string;
  delivered_count: string;
  on_time_rate: string | null;
  revenue: string;
};

export type SeriesQuery = KpiQuery & {
  bucket: TimeBucket;
  /** IANA name from the company record; buckets are cut on its clock. */
  timezone: string;
};

/**
 * Orders, deliveries, on-time rate and revenue per bucket across the range.
 *
 * Buckets with no orders come back as zero rows rather than gaps, so a quiet
 * night draws a line at the floor instead of a hole in the chart.
 */
export async function getTimeSeries(params: SeriesQuery): Promise<SeriesPoint[]> {
  const rows = await query<SeriesRow>(
    `
    select
      b.bucket                                                       as bucket_start,
      count(o.id)::bigint                                            as orders_count,
      count(o.id) filter (where o.status = 'delivered')::bigint      as delivered_count,
      round(
        count(o.id) filter (
          where o.status = 'delivered'
            and o.promised_at is not null
            and o.delivered_at <= o.promised_at
        )::numeric
        / nullif(
            count(o.id) filter (where o.status = 'delivered' and o.promised_at is not null),
            0
          ),
        4
      )                                                              as on_time_rate,
      coalesce(sum(o.delivery_fee) filter (where o.status = 'delivered'), 0)::numeric as revenue
    from generate_series(
           date_trunc($4, ($2::timestamptz at time zone $6)),
           date_trunc($4, ($3::timestamptz at time zone $6) - interval '1 microsecond'),
           $5::interval
         ) as b(bucket)
    left join orders o
      on  o.company_id = $1::uuid
      and o.created_at >= $2::timestamptz
      and o.created_at <  $3::timestamptz
      and ($7::uuid is null or o.zone_id = $7::uuid)
      and date_trunc($4, (o.created_at at time zone $6)) = b.bucket
    group by b.bucket
    order by b.bucket
    `,
    [
      params.companyId,
      params.from.toISOString(),
      params.to.toISOString(),
      params.bucket,
      `1 ${params.bucket}`,
      params.timezone,
      params.zoneId ?? null,
    ],
  );

  return rows.map((row) => ({
    bucketStart: row.bucket_start,
    ordersCount: Number(row.orders_count),
    deliveredCount: Number(row.delivered_count),
    onTimeRate: row.on_time_rate === null ? null : Number(row.on_time_rate),
    revenue: Number(row.revenue),
  }));
}

export type ZonePerformance = {
  zoneId: string;
  code: string;
  name: string;
  ordersCount: number;
  deliveredCount: number;
  lateCount: number;
  onTimeRate: number | null;
  lateRate: number | null;
  avgDeliveryMinutes: number | null;
  revenue: number;
  /** Drivers whose home zone this is. Capacity, in other words. */
  driverCount: number;
  /** Orders per driver per day: demand measured against the capacity to serve it. */
  ordersPerDriverPerDay: number | null;
};

type ZoneRow = {
  zone_id: string;
  code: string;
  name: string;
  orders_count: string;
  delivered_count: string;
  late_count: string;
  on_time_rate: string | null;
  late_rate: string | null;
  avg_delivery_minutes: string | null;
  revenue: string;
  driver_count: string;
  orders_per_driver_per_day: string | null;
};

/**
 * One row per zone for the range, including zones that took no orders at all -
 * an empty zone is itself a finding.
 */
export async function getZonePerformance(
  params: Omit<KpiQuery, 'zoneId'>,
): Promise<ZonePerformance[]> {
  const rows = await query<ZoneRow>(
    `
    with span as (
      select greatest(
        extract(epoch from ($3::timestamptz - $2::timestamptz)) / 86400.0,
        1.0 / 24.0
      ) as days
    ),
    capacity as (
      select home_zone_id, count(*)::numeric as driver_count
        from drivers
       where company_id = $1::uuid and home_zone_id is not null
       group by home_zone_id
    )
    select
      z.id                                                       as zone_id,
      z.code,
      z.name,
      count(o.id)::bigint                                        as orders_count,
      count(o.id) filter (where o.status = 'delivered')::bigint  as delivered_count,
      count(o.id) filter (
        where o.status = 'delayed'
           or (o.status = 'delivered' and o.promised_at is not null and o.delivered_at > o.promised_at)
      )::bigint                                                  as late_count,
      round(
        count(o.id) filter (
          where o.status = 'delivered'
            and o.promised_at is not null
            and o.delivered_at <= o.promised_at
        )::numeric
        / nullif(
            count(o.id) filter (where o.status = 'delivered' and o.promised_at is not null),
            0
          ),
        4
      )                                                          as on_time_rate,
      round(
        count(o.id) filter (
          where o.status = 'delayed'
             or (o.status = 'delivered' and o.promised_at is not null and o.delivered_at > o.promised_at)
        )::numeric / nullif(count(o.id), 0),
        4
      )                                                          as late_rate,
      round(
        avg(extract(epoch from (o.delivered_at - o.picked_up_at)) / 60.0) filter (
          where o.status = 'delivered' and o.picked_up_at is not null
        )::numeric,
        2
      )                                                          as avg_delivery_minutes,
      coalesce(sum(o.delivery_fee) filter (where o.status = 'delivered'), 0)::numeric as revenue,
      coalesce(c.driver_count, 0)::bigint                        as driver_count,
      round(
        count(o.id)::numeric
          / nullif(c.driver_count, 0)
          / (select days from span),
        2
      )                                                          as orders_per_driver_per_day
    from zones z
    left join capacity c on c.home_zone_id = z.id
    left join orders o
      on  o.zone_id = z.id
      and o.created_at >= $2::timestamptz
      and o.created_at <  $3::timestamptz
    where z.company_id = $1::uuid
    group by z.id, z.code, z.name, c.driver_count
    order by z.code
    `,
    [params.companyId, params.from.toISOString(), params.to.toISOString()],
  );

  return rows.map((row) => ({
    zoneId: row.zone_id,
    code: row.code,
    name: row.name,
    ordersCount: Number(row.orders_count),
    deliveredCount: Number(row.delivered_count),
    lateCount: Number(row.late_count),
    onTimeRate: row.on_time_rate === null ? null : Number(row.on_time_rate),
    lateRate: row.late_rate === null ? null : Number(row.late_rate),
    avgDeliveryMinutes: row.avg_delivery_minutes === null ? null : Number(row.avg_delivery_minutes),
    revenue: Number(row.revenue),
    driverCount: Number(row.driver_count),
    ordersPerDriverPerDay:
      row.orders_per_driver_per_day === null ? null : Number(row.orders_per_driver_per_day),
  }));
}
