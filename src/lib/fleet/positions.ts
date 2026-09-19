/**
 * Where the drivers are.
 *
 * `drivers.current_lat/lng` is the live position, written by the tracking
 * integration that does not exist yet. Until it does, the last place a driver
 * actually was is the drop point of their most recent delivery, which is
 * honest, derived entirely from the database, and enough to show the shape of
 * the operation on a map. The UI labels these as last known positions rather
 * than pretending they are live.
 */

import { query } from '@/lib/db/pg';
import type { DriverStatus } from '@/lib/db/types';

export type DriverPosition = {
  driverId: string;
  fullName: string;
  zoneCode: string | null;
  status: DriverStatus;
  lat: number;
  lng: number;
  /** When the driver was last seen there; null when the position is live. */
  lastSeenAt: Date | null;
  /** True when the coordinates came from drivers.current_lat/lng. */
  live: boolean;
};

export async function getDriverPositions(companyId: string): Promise<DriverPosition[]> {
  const rows = await query<{
    driver_id: string;
    full_name: string;
    zone_code: string | null;
    status: DriverStatus;
    lat: number | null;
    lng: number | null;
    last_seen_at: Date | null;
    live: boolean;
  }>(
    `select d.id as driver_id,
            d.full_name,
            z.code as zone_code,
            d.status,
            coalesce(d.current_lat, last_drop.dropoff_lat) as lat,
            coalesce(d.current_lng, last_drop.dropoff_lng) as lng,
            case when d.current_lat is null then last_drop.delivered_at end as last_seen_at,
            (d.current_lat is not null and d.current_lng is not null) as live
       from drivers d
       left join zones z on z.id = d.home_zone_id
       left join lateral (
         select o.dropoff_lat, o.dropoff_lng, o.delivered_at
           from orders o
          where o.driver_id = d.id
            and o.status = 'delivered'
            and o.delivered_at is not null
          order by o.delivered_at desc
          limit 1
       ) last_drop on true
      where d.company_id = $1`,
    [companyId],
  );

  return rows
    .filter(
      (row): row is typeof row & { lat: number; lng: number } =>
        row.lat !== null && row.lng !== null,
    )
    .map((row) => ({
      driverId: row.driver_id,
      fullName: row.full_name,
      zoneCode: row.zone_code,
      status: row.status,
      lat: Number(row.lat),
      lng: Number(row.lng),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
      live: row.live,
    }));
}
