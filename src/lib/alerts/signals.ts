/**
 * The raw signals the alert rules reason over.
 *
 * Each query below is deliberately dumb: it aggregates and returns, and makes
 * no judgement about whether a number is bad. All of the judgement lives in
 * `./rules`, which keeps thresholds in one readable place and makes the rules
 * testable without a database.
 */

import { query } from '@/lib/db/pg';
import type { DateRange } from '@/lib/kpi/types';

export type VehicleFuelSignal = {
  vehicleId: string;
  plate: string;
  type: string;
  /** Litres per kilometre actually burnt over the window. */
  litersPerKm: number;
  liters: number;
  km: number;
  /** What the vehicle is registered to do, converted to litres per km. */
  ratedLitersPerKm: number;
};

export type DriverLoadSignal = {
  driverId: string;
  fullName: string;
  zoneCode: string | null;
  deliveries: number;
};

/**
 * Fuel burnt per kilometre driven, per vehicle.
 *
 * Distance comes from the delivered orders of whoever was driving the vehicle;
 * fuel comes from the expense ledger. A vehicle with no fuel expense or no
 * distance in the window is left out rather than reported as zero.
 */
export async function getVehicleFuelSignals(
  companyId: string,
  range: DateRange,
): Promise<VehicleFuelSignal[]> {
  const rows = await query<{
    vehicle_id: string;
    plate: string;
    type: string;
    liters: string;
    km: string;
    fuel_efficiency_km_per_l: string;
  }>(
    `with fuel as (
       select e.vehicle_id, sum(e.liters) as liters
         from expenses e
        where e.company_id = $1
          and e.category = 'fuel'
          and e.vehicle_id is not null
          and e.liters is not null
          and e.occurred_at >= $2 and e.occurred_at < $3
        group by e.vehicle_id
     ),
     distance as (
       select d.vehicle_id, sum(o.distance_km) as km
         from orders o
         join drivers d on d.id = o.driver_id
        where o.company_id = $1
          and o.status = 'delivered'
          and d.vehicle_id is not null
          and o.delivered_at >= $2 and o.delivered_at < $3
        group by d.vehicle_id
     )
     select v.id as vehicle_id, v.plate, v.type::text as type,
            f.liters, d.km, v.fuel_efficiency_km_per_l
       from vehicles v
       join fuel f     on f.vehicle_id = v.id
       join distance d on d.vehicle_id = v.id
      where v.company_id = $1 and d.km > 0`,
    [companyId, range.from.toISOString(), range.to.toISOString()],
  );

  return rows.map((row) => {
    const liters = Number(row.liters);
    const km = Number(row.km);
    const ratedKmPerL = Number(row.fuel_efficiency_km_per_l);
    return {
      vehicleId: row.vehicle_id,
      plate: row.plate,
      type: row.type,
      liters,
      km,
      litersPerKm: liters / km,
      ratedLitersPerKm: ratedKmPerL > 0 ? 1 / ratedKmPerL : 0,
    };
  });
}

/** Deliveries completed per driver over the window. */
export async function getDriverLoadSignals(
  companyId: string,
  range: DateRange,
): Promise<DriverLoadSignal[]> {
  const rows = await query<{
    driver_id: string;
    full_name: string;
    zone_code: string | null;
    deliveries: string;
  }>(
    `select d.id as driver_id,
            d.full_name,
            z.code as zone_code,
            count(o.id) filter (where o.status = 'delivered')::bigint as deliveries
       from drivers d
       left join zones z on z.id = d.home_zone_id
       left join orders o
              on o.driver_id = d.id
             and o.delivered_at >= $2 and o.delivered_at < $3
      where d.company_id = $1
      group by d.id, d.full_name, z.code`,
    [companyId, range.from.toISOString(), range.to.toISOString()],
  );

  return rows.map((row) => ({
    driverId: row.driver_id,
    fullName: row.full_name,
    zoneCode: row.zone_code,
    deliveries: Number(row.deliveries),
  }));
}
