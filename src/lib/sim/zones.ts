/**
 * The eight service zones of the fictional city.
 *
 * `demandWeight` is relative demand, `radiusKm` sizes the polygon and the
 * spread of drop points, and `trafficFactor` stretches delivery durations for
 * congested or sprawling areas.
 */

export type ZoneSpec = {
  code: string;
  name: string;
  /** Bearing in degrees from the city centre, 0 = north. */
  bearingDeg: number;
  /** Distance of the zone centre from the city centre, in km. */
  offsetKm: number;
  radiusKm: number;
  demandWeight: number;
  trafficFactor: number;
};

export const ZONE_SPECS: readonly ZoneSpec[] = [
  {
    code: 'Z01',
    name: 'Downtown Core',
    bearingDeg: 0,
    offsetKm: 0,
    radiusKm: 2.1,
    demandWeight: 1.6,
    trafficFactor: 1.18,
  },
  {
    code: 'Z02',
    name: 'Harbour District',
    bearingDeg: 45,
    offsetKm: 4.4,
    radiusKm: 2.6,
    demandWeight: 1.15,
    trafficFactor: 1.05,
  },
  {
    code: 'Z03',
    name: 'Old Town',
    bearingDeg: 100,
    offsetKm: 4.0,
    radiusKm: 2.3,
    demandWeight: 1.0,
    trafficFactor: 1.12,
  },
  {
    code: 'Z04',
    name: 'Riverside',
    bearingDeg: 150,
    offsetKm: 5.2,
    radiusKm: 2.9,
    demandWeight: 1.05,
    trafficFactor: 1.02,
  },
  {
    code: 'Z05',
    name: 'Tech Park',
    bearingDeg: 200,
    offsetKm: 5.8,
    radiusKm: 3.1,
    demandWeight: 0.95,
    trafficFactor: 0.94,
  },
  {
    code: 'Z06',
    name: 'North Heights',
    bearingDeg: 255,
    offsetKm: 5.0,
    radiusKm: 2.8,
    demandWeight: 0.85,
    trafficFactor: 0.98,
  },
  {
    code: 'Z07',
    name: 'Airport Corridor',
    bearingDeg: 300,
    offsetKm: 7.6,
    radiusKm: 3.8,
    demandWeight: 0.75,
    trafficFactor: 0.88,
  },
  {
    code: 'Z08',
    name: 'University Quarter',
    bearingDeg: 340,
    offsetKm: 4.2,
    radiusKm: 2.4,
    demandWeight: 1.1,
    trafficFactor: 1.08,
  },
];

export const TOTAL_DEMAND_WEIGHT = ZONE_SPECS.reduce((sum, z) => sum + z.demandWeight, 0);
