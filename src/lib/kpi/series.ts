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
  /**
   * Start of the bucket as the company's own wall clock reads it, carried as
   * an instant pinned to UTC. Format it with `timeZone: 'UTC'` to read back
   * exactly the local time the database cut; converting it to any other zone
   * would shift it twice.
   */
  bucketStart: Date;
  ordersCount: number;
  deliveredCount: number;
  /** Null when nothing in the bucket carried a promised time. */
  onTimeRate: number | null;
  revenue: number;
  avgDeliveryMinutes: number | null;
  /**
   * Cost, profit and utilisation are null on hourly buckets. Expenses are
   * booked once a day and shifts are recorded per day, so splitting either
   * across hours would invent a shape the data does not have.
   */
  totalCost: number | null;
  profit: number | null;
  costPerDelivery: number | null;
  fleetUtilization: number | null;
};

type SeriesRow = {
  bucket_start: string;
  orders_count: string;
  delivered_count: string;
  on_time_rate: string | null;
  revenue: string;
  avg_delivery_minutes: string | null;
  total_cost: string | null;
  profit: string | null;
  cost_per_delivery: string | null;
  fleet_utilization: string | null;
};

export type SeriesQuery = KpiQuery & {
  bucket: TimeBucket;
  /** IANA name from the company record; buckets are cut on its clock. */
  timezone: string;
};

/**
 * Every headline metric, per bucket, across the range.
 *
 * Buckets with no orders come back as zero rows rather than gaps, so a quiet
 * night draws a line at the floor instead of a hole in the chart.
 *
 * Zone scoping follows `kpi_summary`: orders and shifts filter directly,
 * while expenses - which belong to a vehicle or to the company, never to a
 * zone - are allocated pro-rata by that zone's share of the bucket's
 * deliveries. The two layers therefore always agree.
 */
export async function getTimeSeries(params: SeriesQuery): Promise<SeriesPoint[]> {
  const rows = await query<SeriesRow>(
    `
    with buckets as (
      select generate_series(
               date_trunc($4, ($2::timestamptz at time zone $6)),
               date_trunc($4, ($3::timestamptz at time zone $6) - interval '1 microsecond'),
               $5::interval
             ) as bucket
    ),
    scoped_orders as (
      select date_trunc($4, (o.created_at at time zone $6)) as bucket,
             o.status, o.promised_at, o.delivered_at, o.picked_up_at, o.delivery_fee
        from orders o
       where o.company_id = $1::uuid
         and o.created_at >= $2::timestamptz
         and o.created_at <  $3::timestamptz
         and ($7::uuid is null or o.zone_id = $7::uuid)
    ),
    order_stats as (
      select
        bucket,
        count(*)::bigint                                       as orders_count,
        count(*) filter (where status = 'delivered')::bigint   as delivered_count,
        count(*) filter (
          where status = 'delivered' and promised_at is not null
        )::bigint                                              as delivered_with_promise,
        count(*) filter (
          where status = 'delivered' and promised_at is not null and delivered_at <= promised_at
        )::bigint                                              as on_time_count,
        coalesce(sum(delivery_fee) filter (where status = 'delivered'), 0)::numeric as revenue,
        avg(extract(epoch from (delivered_at - picked_up_at)) / 60.0) filter (
          where status = 'delivered' and picked_up_at is not null
        )::numeric                                             as avg_delivery_minutes
      from scoped_orders
      group by bucket
    ),
    -- Company-wide deliveries per bucket, the denominator of the cost share.
    company_stats as (
      select date_trunc($4, (o.created_at at time zone $6)) as bucket,
             count(*) filter (where o.status = 'delivered')::numeric as delivered_count
        from orders o
       where o.company_id = $1::uuid
         and o.created_at >= $2::timestamptz
         and o.created_at <  $3::timestamptz
       group by 1
    ),
    -- Daily buckets only: expenses are booked once a day, so an hourly split
    -- would put a whole day's overhead into one hour.
    expense_stats as (
      select date_trunc($4, (e.occurred_at at time zone $6)) as bucket,
             sum(e.amount)::numeric as total_cost
        from expenses e
       where $4 = 'day'
         and e.company_id = $1::uuid
         and e.occurred_at >= $2::timestamptz
         and e.occurred_at <  $3::timestamptz
       group by 1
    ),
    -- Daily buckets only: a shift is recorded against a date, not a moment.
    shift_stats as (
      select date_trunc($4, s.date::timestamp) as bucket,
             sum(s.active_minutes)::numeric    as active_minutes,
             sum(s.idle_minutes)::numeric      as idle_minutes
        from driver_shifts s
        join drivers d on d.id = s.driver_id
       where $4 = 'day'
         and s.company_id = $1::uuid
         and s.date >= ($2::timestamptz at time zone $6)::date
         and s.date <  ($3::timestamptz at time zone $6)::date
         and ($7::uuid is null or d.home_zone_id = $7::uuid)
       group by 1
    ),
    scoped as (
      select
        b.bucket,
        coalesce(os.orders_count, 0)     as orders_count,
        coalesce(os.delivered_count, 0)  as delivered_count,
        round(
          os.on_time_count::numeric / nullif(os.delivered_with_promise, 0), 4
        )                                as on_time_rate,
        coalesce(os.revenue, 0)          as revenue,
        round(os.avg_delivery_minutes, 2) as avg_delivery_minutes,
        round(
          es.total_cost * case
            when $7::uuid is null then 1.0
            when coalesce(cs.delivered_count, 0) = 0 then 0
            else coalesce(os.delivered_count, 0)::numeric / cs.delivered_count
          end,
          2
        )                                as total_cost,
        round(
          ss.active_minutes / nullif(ss.active_minutes + ss.idle_minutes, 0), 4
        )                                as fleet_utilization
      from buckets b
      left join order_stats os   on os.bucket = b.bucket
      left join company_stats cs on cs.bucket = b.bucket
      left join expense_stats es on es.bucket = b.bucket
      left join shift_stats ss   on ss.bucket = b.bucket
    )
    select
      -- The bucket is a naive local timestamp. Rendered as text with an
      -- explicit Z, it reaches JavaScript as the same wall clock whatever
      -- timezone the Node process happens to run in; parsing it as a bare
      -- timestamp would silently shift it by the server's own offset.
      to_char(bucket, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')         as bucket_start,
      orders_count::bigint                                  as orders_count,
      delivered_count::bigint                               as delivered_count,
      on_time_rate,
      revenue,
      avg_delivery_minutes,
      total_cost,
      round(revenue - total_cost, 2)                        as profit,
      round(total_cost / nullif(delivered_count, 0), 2)     as cost_per_delivery,
      fleet_utilization
    from scoped
    order by bucket
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

  const toNullable = (value: string | null): number | null =>
    value === null ? null : Number(value);

  return rows.map((row) => ({
    bucketStart: new Date(row.bucket_start),
    ordersCount: Number(row.orders_count),
    deliveredCount: Number(row.delivered_count),
    onTimeRate: toNullable(row.on_time_rate),
    revenue: Number(row.revenue),
    avgDeliveryMinutes: toNullable(row.avg_delivery_minutes),
    totalCost: toNullable(row.total_cost),
    profit: toNullable(row.profit),
    costPerDelivery: toNullable(row.cost_per_delivery),
    fleetUtilization: toNullable(row.fleet_utilization),
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
