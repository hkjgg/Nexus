/**
 * The tenant and its geography.
 *
 * Currency, locale and timezone all come from the company row, so no screen
 * ever hard-codes a dollar sign or a clock.
 */

import { query } from '@/lib/db/pg';
import type { GeoJsonPolygon } from '@/lib/db/types';

export type Company = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
};

/** The public demo tenant. Multi-tenant routing replaces this later. */
export async function getDemoCompany(): Promise<Company | null> {
  const rows = await query<Company>(
    `select id, name, currency, timezone
       from companies
      where is_demo
      order by created_at
      limit 1`,
  );
  return rows[0] ?? null;
}

export type ZoneSummary = {
  id: string;
  code: string;
  name: string;
  polygon: GeoJsonPolygon;
  centerLat: number;
  centerLng: number;
};

type ZoneRow = {
  id: string;
  code: string;
  name: string;
  polygon: GeoJsonPolygon;
  center_lat: number;
  center_lng: number;
};

export async function getZones(companyId: string): Promise<ZoneSummary[]> {
  const rows = await query<ZoneRow>(
    `select id, code, name, polygon, center_lat, center_lng
       from zones
      where company_id = $1::uuid
      order by code`,
    [companyId],
  );

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    polygon: row.polygon,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
  }));
}
