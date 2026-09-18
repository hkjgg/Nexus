/**
 * The rules.
 *
 * Each one is a pure function from measurements to findings: no database, no
 * clock, no randomness. That makes them testable, makes the thresholds
 * arguable, and keeps the queries in the KPI layer where the rest of the
 * arithmetic lives.
 *
 * No rule names a zone, a vehicle or a driver. Every one compares an entity
 * against its own peers, so the findings survive a reseed, a new zone or a
 * change of fleet.
 */

import type { DailyOpsFact, DriverLoadFact, VehicleFuelFact } from '@/lib/kpi/operations';
import type { ZonePerformance } from '@/lib/kpi/series';
import type { NexusAlert } from './types';

/**
 * Every threshold in the system, in one place.
 *
 * They are ratios against a peer median rather than absolute numbers, so a
 * company that runs twice the volume does not get twice the alerts.
 */
export const ALERT_THRESHOLDS = {
  zoneCapacity: {
    /** Orders per driver per day, relative to the median zone. */
    loadRatio: 1.25,
    criticalLoadRatio: 1.45,
    /** Late rate relative to the median zone. Both must trip. */
    lateRatio: 1.4,
    criticalLateRatio: 2,
  },
  vehicleFuel: {
    /** Litres per km above the median vehicle of the same type. */
    excess: 0.2,
    criticalExcess: 0.3,
    /** Below this distance the ratio is too noisy to act on. */
    minKm: 50,
  },
  driverLoad: {
    /** Deliveries relative to the median driver in the same zone. */
    excess: 0.25,
    criticalExcess: 0.4,
    /** A zone with fewer drivers than this has no meaningful median. */
    minPeers: 3,
    /**
     * Below this many deliveries the median is too thin to lean on: over a
     * single day a quarter more than the median can be four extra drops,
     * which is a busy afternoon rather than a pattern.
     */
    minMedianDeliveries: 25,
  },
  dayAnomaly: {
    /** Average delivery time above the median day. */
    durationExcess: 0.25,
    criticalDurationExcess: 0.4,
    /** Late rate relative to the median day. */
    lateRatio: 2,
    /** Fewer days than this and there is nothing to compare against. */
    minDays: 7,
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Median of a non-empty list. Returns null for an empty one. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const pct = (value: number, digits = 1): string => `${(value * 100).toFixed(digits)}%`;
const num = (value: number, digits = 1): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ---------------------------------------------------------------------------
// Rule 1 - a zone whose demand has outgrown its drivers
// ---------------------------------------------------------------------------

/**
 * Fires when a zone carries materially more orders per driver than the median
 * zone *and* is running late because of it. Either signal alone is innocent:
 * a busy zone with good service is well staffed, and a late zone with a
 * normal load has a different problem - traffic, addresses, a broken vehicle.
 * Together they are a capacity shortfall.
 */
export function zoneCapacityRule(zones: readonly ZonePerformance[]): NexusAlert[] {
  const staffed = zones.filter(
    (zone): zone is ZonePerformance & { ordersPerDriverPerDay: number; lateRate: number } =>
      zone.ordersPerDriverPerDay !== null && zone.lateRate !== null && zone.driverCount > 0,
  );
  if (staffed.length < 3) return [];

  const medianLoad = median(staffed.map((z) => z.ordersPerDriverPerDay));
  const medianLate = median(staffed.map((z) => z.lateRate));
  if (medianLoad === null || medianLate === null || medianLoad === 0) return [];

  const { zoneCapacity: t } = ALERT_THRESHOLDS;
  const alerts: NexusAlert[] = [];

  for (const zone of staffed) {
    const loadRatio = zone.ordersPerDriverPerDay / medianLoad;
    // A median late rate of zero means any lateness is a deviation.
    const lateRatio =
      medianLate === 0 ? (zone.lateRate > 0 ? Infinity : 1) : zone.lateRate / medianLate;

    if (loadRatio < t.loadRatio || lateRatio < t.lateRatio) continue;

    const critical = loadRatio >= t.criticalLoadRatio || lateRatio >= t.criticalLateRatio;

    alerts.push({
      id: `zone_capacity:${zone.zoneId}`,
      kind: 'zone_capacity',
      severity: critical ? 'critical' : 'warning',
      title: 'Zone demand has outgrown its drivers',
      subject: `Zone ${zone.code} · ${zone.name}`,
      message:
        `${zone.name} is handling ${num(zone.ordersPerDriverPerDay)} orders per driver per day ` +
        `against a median of ${num(medianLoad)} across the network, on ${zone.driverCount} ` +
        `drivers. Service is following the load down: ${pct(zone.lateRate)} of its orders are ` +
        `late against a median of ${pct(medianLate)}. The zone needs headcount, not a faster route.`,
      evidence:
        `${num(loadRatio, 2)}× median load · ${num(lateRatio, 2)}× median late rate · ` +
        `${zone.ordersCount.toLocaleString('en-US')} orders`,
      magnitude: loadRatio - t.loadRatio,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Rule 2 - a vehicle burning more fuel than its peers
// ---------------------------------------------------------------------------

/**
 * Compares litres per kilometre against the median vehicle of the same type.
 * A van is never compared with a motorbike, and a vehicle is never compared
 * with itself, so one bad unit cannot drag the baseline toward itself.
 */
export function vehicleFuelRule(vehicles: readonly VehicleFuelFact[]): NexusAlert[] {
  const { vehicleFuel: t } = ALERT_THRESHOLDS;

  const usable = vehicles.filter(
    (v): v is VehicleFuelFact & { litersPerKm: number } =>
      v.litersPerKm !== null && v.litersPerKm > 0 && v.km >= t.minKm,
  );

  const alerts: NexusAlert[] = [];

  for (const vehicle of usable) {
    const peers = usable.filter((p) => p.type === vehicle.type && p.id !== vehicle.id);
    if (peers.length < 2) continue;

    const peerMedian = median(peers.map((p) => p.litersPerKm));
    if (peerMedian === null || peerMedian === 0) continue;

    const excess = vehicle.litersPerKm / peerMedian - 1;
    if (excess < t.excess) continue;

    alerts.push({
      id: `vehicle_fuel:${vehicle.id}`,
      kind: 'vehicle_fuel',
      severity: excess >= t.criticalExcess ? 'critical' : 'warning',
      title: 'Vehicle burning more fuel than its peers',
      subject: `${vehicle.type} ${vehicle.plate}`,
      message:
        `${vehicle.plate} burned ${pct(excess)} more fuel per kilometre than the median ` +
        `${vehicle.type} in the fleet over the same period, on comparable distance. ` +
        `It is registered at ${num(vehicle.ratedKmPerLiter, 1)} km/L, the same as its peers, ` +
        `so a gap this size is mechanical rather than a matter of driving style: ` +
        `worth a service booking.`,
      evidence:
        `${num(vehicle.litersPerKm, 3)} L/km vs peer median ${num(peerMedian, 3)} L/km · ` +
        `${num(vehicle.liters, 0)} L over ${num(vehicle.km, 0)} km`,
      magnitude: excess - t.excess,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Rule 3 - drivers carrying more than their zone peers
// ---------------------------------------------------------------------------

/**
 * Compares each driver against the median driver *in the same zone*.
 *
 * Comparing against the whole company would flag every driver in an
 * understaffed zone, which is the zone's problem and is already reported by
 * the capacity rule. Within a zone, a driver well above the median is a
 * dispatch imbalance: the same shift, the same streets, far more drops.
 */
export function driverLoadRule(drivers: readonly DriverLoadFact[]): NexusAlert[] {
  const { driverLoad: t } = ALERT_THRESHOLDS;

  const byZone = new Map<string, DriverLoadFact[]>();
  for (const driver of drivers) {
    if (driver.zoneCode === null || driver.deliveries === 0) continue;
    const list = byZone.get(driver.zoneCode);
    if (list) list.push(driver);
    else byZone.set(driver.zoneCode, [driver]);
  }

  const alerts: NexusAlert[] = [];

  for (const [zoneCode, peers] of byZone) {
    if (peers.length < t.minPeers) continue;

    const zoneMedian = median(peers.map((p) => p.deliveries));
    if (zoneMedian === null || zoneMedian < t.minMedianDeliveries) continue;

    for (const driver of peers) {
      const excess = driver.deliveries / zoneMedian - 1;
      if (excess < t.excess) continue;

      alerts.push({
        id: `driver_load:${driver.id}`,
        kind: 'driver_load',
        severity: excess >= t.criticalExcess ? 'critical' : 'warning',
        title: 'Driver carrying more than their zone',
        subject: `${driver.fullName} · ${zoneCode}`,
        message:
          `${driver.fullName} completed ${driver.deliveries.toLocaleString('en-US')} deliveries ` +
          `against a median of ${num(zoneMedian, 0)} for the ${peers.length} drivers in ` +
          `${zoneCode} - ${pct(excess)} more than their peers on the same streets. ` +
          `Dispatch is favouring them, and burnout and errors follow sustained overload.`,
        evidence:
          `${driver.deliveries.toLocaleString('en-US')} deliveries vs zone median ` +
          `${num(zoneMedian, 0)} · ${num(driver.activeMinutes / 60, 0)} h active`,
        magnitude: excess - t.excess,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Rule 4 - a day that does not look like the others
// ---------------------------------------------------------------------------

/**
 * Finds days whose delivery times ran far above the median day, and reports
 * the worst of them.
 *
 * The rule does not know about weather - it knows that one day took much
 * longer than its neighbours and that lateness spiked with it, which is the
 * shape a storm, a road closure or a systems outage all leave behind. Naming
 * the cause is the analyst's job; surfacing the day is this rule's.
 */
export function dayAnomalyRule(days: readonly DailyOpsFact[]): NexusAlert[] {
  const { dayAnomaly: t } = ALERT_THRESHOLDS;

  const usable = days.filter(
    (d): d is DailyOpsFact & { avgDeliveryMinutes: number; lateRate: number } =>
      d.avgDeliveryMinutes !== null && d.lateRate !== null && d.ordersCount > 0,
  );
  if (usable.length < t.minDays) return [];

  const medianDuration = median(usable.map((d) => d.avgDeliveryMinutes));
  const medianLate = median(usable.map((d) => d.lateRate));
  if (medianDuration === null || medianLate === null || medianDuration === 0) return [];

  const anomalies = usable
    .map((day) => ({
      day,
      durationExcess: day.avgDeliveryMinutes / medianDuration - 1,
      lateRatio: medianLate === 0 ? Infinity : day.lateRate / medianLate,
    }))
    .filter((a) => a.durationExcess >= t.durationExcess && a.lateRatio >= t.lateRatio)
    .sort((a, b) => b.durationExcess - a.durationExcess);

  // One finding, not one per bad day: the operator needs to know the worst day
  // happened, and the count tells them whether it is a pattern.
  const worst = anomalies[0];
  if (!worst) return [];

  const others = anomalies.length - 1;

  return [
    {
      id: `day_anomaly:${worst.day.day}`,
      kind: 'day_anomaly',
      severity: worst.durationExcess >= t.criticalDurationExcess ? 'critical' : 'warning',
      title: 'A day ran far outside the norm',
      subject: worst.day.day,
      message:
        `Deliveries on ${worst.day.day} averaged ${num(worst.day.avgDeliveryMinutes)} minutes ` +
        `against a median of ${num(medianDuration)}, and ${pct(worst.day.lateRate)} of that ` +
        `day's ${worst.day.ordersCount.toLocaleString('en-US')} orders ran late against a ` +
        `median of ${pct(medianLate)}. ` +
        (others > 0
          ? `${others} other day${others === 1 ? '' : 's'} in the window look the same, so this is a pattern worth a cause.`
          : `Nothing else in the window looks like it - a one-off disruption rather than a trend.`),
      evidence:
        `${num(worst.day.avgDeliveryMinutes)} min vs ${num(medianDuration)} min median · ` +
        `${num(worst.lateRatio, 1)}× median late rate`,
      magnitude: worst.durationExcess - t.durationExcess,
    },
  ];
}
