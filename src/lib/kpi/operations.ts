/**
 * Operational facts: where the drivers are, what the fleet is burning, how
 * the work is shared out, and how each day compared with the others.
 *
 * These feed the live map and the alert rules. They deliberately return
 * measurements rather than judgements - deciding what counts as "too much"
 * is the rule engine's job, and it lives in `src/lib/alerts`.
 */

import { query } from '@/lib/db/pg';
import type { DriverStatus } from '@/lib/db/types';
import type { DateRange } from './types';

export type DriverPosition = {
  id: string;
  fullName: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  zoneCode: string | null;
  /**
   * `live` is a position reported while the driver is on shift. `last_drop`
   * is where they finished their most recent delivery, which is all there is
   * to show for a driver who is off shift right now.
   */
  source: 'live' | 'last_drop';
  /** When the position was established. */
  asOf: Date | null;
};

type DriverPositionRow = {
  id: string;
  full_name: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  zone_code: string | null;
  source: 'live' | 'last_drop';
  as_of: Date | null;
};

/**
 * Where every driver is, or was last seen.
 *
 * Drivers on shift report a live position. Outside their shift there is
 * nothing live to report, so the map falls back to the drop-off point of
 * their most recent delivery rather than dropping them off the map: at three
 * in the morning an empty map says nothing, whereas last-known positions
 * still show how the fleet is spread across the city.
 */
export async function getDriverPositions(companyId: string): Promise<DriverPosition[]> {
  const rows = await query<DriverPositionRow>(
    `
    with last_drop as (
      select distinct on (o.driver_id)
             o.driver_id, o.dropoff_lat, o.dropoff_lng, o.delivered_at
        from orders o
       where o.company_id = $1::uuid
         and o.status = 'delivered'
         and o.driver_id is not null
         and o.delivered_at is not null
       order by o.driver_id, o.delivered_at desc
    )
    select
      d.id,
      d.full_name,
      d.status,
      coalesce(d.current_lat, ld.dropoff_lat)  as lat,
      coalesce(d.current_lng, ld.dropoff_lng)  as lng,
      z.code                                   as zone_code,
      case when d.current_lat is not null then 'live' else 'last_drop' end as source,
      case when d.current_lat is not null then now() else ld.delivered_at end as as_of
    from drivers d
    left join zones z     on z.id = d.home_zone_id
    left join last_drop ld on ld.driver_id = d.id
    where d.company_id = $1::uuid
      and coalesce(d.current_lat, ld.dropoff_lat) is not null
    order by d.full_name
    `,
    [companyId],
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    status: row.status,
    lat: Number(row.lat),
    lng: Number(row.lng),
    zoneCode: row.zone_code,
    source: row.source,
    asOf: row.as_of,
  }));
}

export type VehicleFuelFact = {
  id: string;
  plate: string;
  type: string;
  liters: number;
  /** Distance attributed to the vehicle through the orders its driver ran. */
  km: number;
  /** Null when the vehicle did not move in the range. */
  litersPerKm: number | null;
  /** What the vehicle is registered to achieve, for context in the message. */
  ratedKmPerLiter: number;
};

type VehicleFuelRow = {
  id: string;
  plate: string;
  type: string;
  liters: string;
  km: string;
  liters_per_km: string | null;
  rated_km_per_liter: string;
};

/**
 * Fuel actually burned per kilometre actually driven, per vehicle.
 *
 * Distance is not recorded against a vehicle, so it is reconstructed from the
 * orders its driver completed. The reconstruction under-counts real road
 * distance by a constant factor - the trip to pickup, routing, the run back -
 * but the factor is the same for every vehicle, so comparing one against its
 * peers stays valid.
 */
export async function getVehicleFuelFacts(
  companyId: string,
  range: DateRange,
): Promise<VehicleFuelFact[]> {
  const rows = await query<VehicleFuelRow>(
    `
    with fuel as (
      select vehicle_id, coalesce(sum(liters), 0)::numeric as liters
        from expenses
       where company_id = $1::uuid
         and category = 'fuel'
         and vehicle_id is not null
         and occurred_at >= $2::timestamptz
         and occurred_at <  $3::timestamptz
       group by vehicle_id
    ),
    distance as (
      select d.vehicle_id, coalesce(sum(o.distance_km), 0)::numeric as km
        from orders o
        join drivers d on d.id = o.driver_id
       where o.company_id = $1::uuid
         and o.status = 'delivered'
         and o.created_at >= $2::timestamptz
         and o.created_at <  $3::timestamptz
         and d.vehicle_id is not null
       group by d.vehicle_id
    )
    select
      v.id,
      v.plate,
      v.type::text                                        as type,
      coalesce(f.liters, 0)                               as liters,
      coalesce(dist.km, 0)                                as km,
      round(coalesce(f.liters, 0) / nullif(dist.km, 0), 5) as liters_per_km,
      v.fuel_efficiency_km_per_l                          as rated_km_per_liter
    from vehicles v
    left join fuel f      on f.vehicle_id = v.id
    left join distance dist on dist.vehicle_id = v.id
    where v.company_id = $1::uuid
    order by v.plate
    `,
    [companyId, range.from.toISOString(), range.to.toISOString()],
  );

  return rows.map((row) => ({
    id: row.id,
    plate: row.plate,
    type: row.type,
    liters: Number(row.liters),
    km: Number(row.km),
    litersPerKm: row.liters_per_km === null ? null : Number(row.liters_per_km),
    ratedKmPerLiter: Number(row.rated_km_per_liter),
  }));
}

export type DriverLoadFact = {
  id: string;
  fullName: string;
  zoneCode: string | null;
  deliveries: number;
  activeMinutes: number;
};

type DriverLoadRow = {
  id: string;
  full_name: string;
  zone_code: string | null;
  deliveries: string;
  active_minutes: string;
};

/** Deliveries completed and minutes worked per driver over the range. */
export async function getDriverLoadFacts(
  companyId: string,
  range: DateRange,
): Promise<DriverLoadFact[]> {
  const rows = await query<DriverLoadRow>(
    `
    with deliveries as (
      select driver_id, count(*)::bigint as n
        from orders
       where company_id = $1::uuid
         and status = 'delivered'
         and driver_id is not null
         and created_at >= $2::timestamptz
         and created_at <  $3::timestamptz
       group by driver_id
    ),
    worked as (
      select driver_id, coalesce(sum(active_minutes), 0)::bigint as minutes
        from driver_shifts
       where company_id = $1::uuid
         and date >= ($2::timestamptz at time zone 'UTC')::date
         and date <  ($3::timestamptz at time zone 'UTC')::date
       group by driver_id
    )
    select
      d.id,
      d.full_name,
      z.code                              as zone_code,
      coalesce(dl.n, 0)::bigint           as deliveries,
      coalesce(w.minutes, 0)::bigint      as active_minutes
    from drivers d
    left join zones z       on z.id = d.home_zone_id
    left join deliveries dl on dl.driver_id = d.id
    left join worked w      on w.driver_id = d.id
    where d.company_id = $1::uuid
    order by d.full_name
    `,
    [companyId, range.from.toISOString(), range.to.toISOString()],
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    zoneCode: row.zone_code,
    deliveries: Number(row.deliveries),
    activeMinutes: Number(row.active_minutes),
  }));
}

export type DailyOpsFact = {
  /** Calendar day in the company's timezone. */
  day: string;
  ordersCount: number;
  avgDeliveryMinutes: number | null;
  lateRate: number | null;
  cancellationRate: number | null;
};

type DailyOpsRow = {
  day: string;
  orders_count: string;
  avg_delivery_minutes: string | null;
  late_rate: string | null;
  cancellation_rate: string | null;
};

/**
 * One row per calendar day. The rule engine uses it to find the days that do
 * not look like the others - a storm, an outage, a public holiday.
 */
export async function getDailyOpsFacts(
  companyId: string,
  range: DateRange,
  timezone: string,
): Promise<DailyOpsFact[]> {
  const rows = await query<DailyOpsRow>(
    `
    select
      to_char(date_trunc('day', (created_at at time zone $4)), 'YYYY-MM-DD') as day,
      count(*)::bigint                                                       as orders_count,
      round(
        avg(extract(epoch from (delivered_at - picked_up_at)) / 60.0) filter (
          where status = 'delivered' and picked_up_at is not null
        )::numeric,
        2
      )                                                                      as avg_delivery_minutes,
      round(
        count(*) filter (
          where status = 'delayed'
             or (status = 'delivered' and promised_at is not null and delivered_at > promised_at)
        )::numeric / nullif(count(*), 0),
        4
      )                                                                      as late_rate,
      round(
        count(*) filter (where status = 'cancelled')::numeric / nullif(count(*), 0),
        4
      )                                                                      as cancellation_rate
    from orders
    where company_id = $1::uuid
      and created_at >= $2::timestamptz
      and created_at <  $3::timestamptz
    group by 1
    order by 1
    `,
    [companyId, range.from.toISOString(), range.to.toISOString(), timezone],
  );

  return rows.map((row) => ({
    day: row.day,
    ordersCount: Number(row.orders_count),
    avgDeliveryMinutes: row.avg_delivery_minutes === null ? null : Number(row.avg_delivery_minutes),
    lateRate: row.late_rate === null ? null : Number(row.late_rate),
    cancellationRate: row.cancellation_rate === null ? null : Number(row.cancellation_rate),
  }));
}
