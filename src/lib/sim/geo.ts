/**
 * Small geospatial helpers for the simulation.
 *
 * The city is fictional, so a local flat-earth approximation is plenty: at
 * this latitude one degree of latitude is ~111 km and one degree of longitude
 * is ~111 km * cos(lat).
 */

import type { GeoJsonPolygon } from '@/lib/db/types';
import type { Rng } from './rng';

const KM_PER_DEGREE_LAT = 111.32;

export function kmPerDegreeLng(latitude: number): number {
  return KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
}

/** Great-circle-ish distance in kilometres between two points. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const midLat = (aLat + bLat) / 2;
  const dLat = (bLat - aLat) * KM_PER_DEGREE_LAT;
  const dLng = (bLng - aLng) * kmPerDegreeLng(midLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Builds a hexagon around a centre point, with a little per-vertex jitter so
 * the zones read as hand-drawn service areas rather than a tiling.
 */
export function hexagonPolygon(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  rng: Rng,
): GeoJsonPolygon {
  const lngScale = kmPerDegreeLng(centerLat);
  const ring: [number, number][] = [];

  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const r = radiusKm * rng.float(0.86, 1.14);
    const lat = centerLat + (r * Math.sin(angle)) / KM_PER_DEGREE_LAT;
    const lng = centerLng + (r * Math.cos(angle)) / lngScale;
    ring.push([round6(lng), round6(lat)]);
  }
  // GeoJSON polygons must be explicitly closed.
  ring.push([ring[0]![0], ring[0]![1]]);

  return { type: 'Polygon', coordinates: [ring] };
}

/** A random point within `radiusKm` of a centre, uniform over the disc. */
export function randomPointNear(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  rng: Rng,
): { lat: number; lng: number } {
  // sqrt keeps the distribution uniform by area instead of clustering at the centre.
  const r = radiusKm * Math.sqrt(rng.next());
  const angle = rng.float(0, Math.PI * 2);
  const lat = centerLat + (r * Math.sin(angle)) / KM_PER_DEGREE_LAT;
  const lng = centerLng + (r * Math.cos(angle)) / kmPerDegreeLng(centerLat);
  return { lat: round6(lat), lng: round6(lng) };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
