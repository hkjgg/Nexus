/**
 * The alert rules.
 *
 * Every rule is a pure function: signals in, alerts out. No database, no
 * clock, no formatting decisions that depend on where it is rendered. That is
 * what makes the thresholds below the whole of the product's opinion about
 * when an operator should be interrupted - there is nothing hidden in a query.
 *
 * Each rule compares a subject against its own peers rather than against a
 * fixed number, so the alerts keep working when the operation grows: a zone is
 * late relative to the other zones, a van drinks relative to the other vans of
 * its type, a day is bad relative to the other days in the window.
 */

import type { KpiSeriesPoint } from '@/lib/kpi/series';
import type { ZonePerformance } from '@/lib/kpi/zones';
import type { DriverLoadSignal, VehicleFuelSignal } from './signals';
import type { OperationalAlert } from './types';

export const THRESHOLDS = {
  /** A zone is strained when its delay rate is this multiple of the zone median. */
  zoneLateRateVsMedian: 1.5,
  /** ...and it is carrying this multiple of the median load per driver. */
  zoneLoadVsMedian: 1.25,
  /** Above this multiple of the median the zone is treated as critical. */
  zoneCriticalLateRateVsMedian: 2.0,
  /** A zone needs this many orders in the window before it is judged at all. */
  zoneMinOrders: 100,

  /** A vehicle is flagged when it burns this much more per km than its peers. */
  vehicleFuelExcess: 0.2,
  /** ...having driven at least this far, so a short week cannot trip it. */
  vehicleMinKm: 100,

  /** A driver is overloaded at this much above the median delivery count. */
  driverLoadExcess: 0.2,
  /** Drivers below this many deliveries are treated as part-time, not loaded. */
  driverMinDeliveries: 20,

  /** A day spikes when its delay rate is this multiple of the window median... */
  daySpikeVsMedian: 2.0,
  /** ...and is at least this bad in absolute terms. */
  daySpikeFloor: 0.15,
  /** Days quieter than this are noise, not signal. */
  dayMinOrders: 50,
} as const;

/** Median of a non-empty list. Returns null for an empty one. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const pct = (value: number, digits = 1): string => `${(value * 100).toFixed(digits)}%`;

/**
 * Rule 1 - a zone whose demand has outgrown the drivers based in it.
 *
 * Late deliveries alone are not enough: a zone can be late because of a road
 * closure. Pairing the delay rate with load per driver is what makes this
 * specifically a capacity problem, and what makes "add a driver" the obvious
 * response.
 */
export function zoneCapacityRule(
  zones: readonly ZonePerformance[],
  detectedAt: Date,
): OperationalAlert[] {
  const eligible = zones.filter((z) => z.ordersCount >= THRESHOLDS.zoneMinOrders);
  if (eligible.length < 3) return [];

  const lateRate = (z: ZonePerformance) => z.lateCount / z.ordersCount;

  const medianLate = median(eligible.map(lateRate));
  const medianLoad = median(
    eligible.map((z) => z.ordersPerDriver).filter((v): v is number => v !== null),
  );
  if (medianLate === null || medianLate === 0 || medianLoad === null) return [];

  return eligible
    .filter((zone) => {
      const strained = lateRate(zone) >= medianLate * THRESHOLDS.zoneLateRateVsMedian;
      const overloaded =
        zone.ordersPerDriver !== null &&
        zone.ordersPerDriver >= medianLoad * THRESHOLDS.zoneLoadVsMedian;
      return strained && overloaded;
    })
    .map((zone) => {
      const rate = lateRate(zone);
      const critical = rate >= medianLate * THRESHOLDS.zoneCriticalLateRateVsMedian;
      const threshold = medianLate * THRESHOLDS.zoneLateRateVsMedian;

      return {
        id: `zone-capacity-strain:${zone.zoneId}`,
        rule: 'zone-capacity-strain' as const,
        severity: critical ? ('critical' as const) : ('warning' as const),
        title: `${zone.name} is running past its capacity`,
        message:
          `${zone.code} is delivering ${pct(rate)} of its orders late against a ` +
          `${pct(medianLate)} median across zones, while its ${zone.driverCount} drivers each ` +
          `carry ${zone.ordersPerDriver?.toFixed(0)} orders against a median of ` +
          `${medianLoad.toFixed(0)}. Demand has outgrown the headcount based there.`,
        entity: { kind: 'zone' as const, id: zone.zoneId, label: `Zone ${zone.code}` },
        metric: 'delay_rate',
        value: rate,
        threshold,
        valueLabel: pct(rate),
        thresholdLabel: pct(threshold),
        detectedAt,
      };
    });
}

/**
 * Rule 2 - a vehicle burning more fuel per kilometre than its peers.
 *
 * Compared within its own type, because a truck is always going to drink more
 * than a motorbike and that is not news.
 */
export function vehicleFuelRule(
  vehicles: readonly VehicleFuelSignal[],
  detectedAt: Date,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  const byType = new Map<string, VehicleFuelSignal[]>();
  for (const vehicle of vehicles) {
    if (vehicle.km < THRESHOLDS.vehicleMinKm) continue;
    const bucket = byType.get(vehicle.type);
    if (bucket) bucket.push(vehicle);
    else byType.set(vehicle.type, [vehicle]);
  }

  for (const [type, peers] of byType) {
    // With fewer than three of a type there is no peer group worth the name.
    if (peers.length < 3) continue;

    const peerMedian = median(peers.map((v) => v.litersPerKm));
    if (peerMedian === null || peerMedian === 0) continue;

    const threshold = peerMedian * (1 + THRESHOLDS.vehicleFuelExcess);

    for (const vehicle of peers) {
      if (vehicle.litersPerKm < threshold) continue;

      const excess = vehicle.litersPerKm / peerMedian - 1;
      const litresWasted = (vehicle.litersPerKm - peerMedian) * vehicle.km;

      alerts.push({
        id: `vehicle-fuel-anomaly:${vehicle.vehicleId}`,
        rule: 'vehicle-fuel-anomaly',
        severity: excess >= THRESHOLDS.vehicleFuelExcess * 2 ? 'critical' : 'warning',
        title: `${vehicle.plate} is burning ${pct(excess, 0)} more fuel than its peers`,
        message:
          `Over ${vehicle.km.toFixed(0)} km this ${type} used ` +
          `${vehicle.litersPerKm.toFixed(3)} L/km against a ${peerMedian.toFixed(3)} L/km median ` +
          `for the other ${type}s - about ${litresWasted.toFixed(0)} litres more than the fleet ` +
          `norm. Worth a service check before the next long run.`,
        entity: { kind: 'vehicle', id: vehicle.vehicleId, label: vehicle.plate },
        metric: 'liters_per_km',
        value: vehicle.litersPerKm,
        threshold,
        valueLabel: `${vehicle.litersPerKm.toFixed(3)} L/km`,
        thresholdLabel: `${threshold.toFixed(3)} L/km`,
        detectedAt,
      });
    }
  }

  return alerts;
}

/**
 * Rule 3 - drivers carrying materially more than the median.
 *
 * Reported as one alert rather than one per driver: an operator wants to know
 * that the roster is lopsided, not to dismiss six notifications.
 */
export function driverOverloadRule(
  drivers: readonly DriverLoadSignal[],
  detectedAt: Date,
): OperationalAlert[] {
  const working = drivers.filter((d) => d.deliveries >= THRESHOLDS.driverMinDeliveries);
  if (working.length < 5) return [];

  const medianLoad = median(working.map((d) => d.deliveries));
  if (medianLoad === null || medianLoad === 0) return [];

  const threshold = medianLoad * (1 + THRESHOLDS.driverLoadExcess);
  const overloaded = working
    .filter((d) => d.deliveries >= threshold)
    .sort((a, b) => b.deliveries - a.deliveries);

  if (overloaded.length === 0) return [];

  const worst = overloaded[0];
  const named = overloaded
    .slice(0, 3)
    .map((d) => `${d.fullName} (${d.deliveries}${d.zoneCode ? `, ${d.zoneCode}` : ''})`)
    .join(', ');
  const rest = overloaded.length - Math.min(3, overloaded.length);

  return [
    {
      id: 'driver-overload:roster',
      rule: 'driver-overload',
      severity: worst.deliveries >= medianLoad * 1.4 ? 'critical' : 'warning',
      title: `${overloaded.length} driver${overloaded.length === 1 ? ' is' : 's are'} carrying an outsized share`,
      message:
        `${named}${rest > 0 ? ` and ${rest} other${rest === 1 ? '' : 's'}` : ''} ` +
        `completed at least ${threshold.toFixed(0)} deliveries against a roster median of ` +
        `${medianLoad.toFixed(0)}. Rebalancing dispatch would take pressure off them before it ` +
        `shows up as delays.`,
      entity: { kind: 'driver', id: worst.driverId, label: worst.fullName },
      metric: 'deliveries_per_driver',
      value: worst.deliveries,
      threshold,
      valueLabel: `${worst.deliveries} deliveries`,
      thresholdLabel: `${threshold.toFixed(0)} deliveries`,
      detectedAt,
    },
  ];
}

/**
 * Rule 4 - a single day where delays spiked well clear of the rest.
 *
 * The cause is usually external (weather, a closure, a public holiday), which
 * is precisely why it is worth separating from the underlying trend instead of
 * letting it drag the weekly average around unexplained.
 */
export function dailySpikeRule(
  series: readonly KpiSeriesPoint[],
  timeZone: string,
): OperationalAlert[] {
  const days = series.filter((point) => point.ordersCount >= THRESHOLDS.dayMinOrders);
  if (days.length < 5) return [];

  const rateOf = (point: KpiSeriesPoint) => point.lateCount / point.ordersCount;
  const medianRate = median(days.map(rateOf));
  if (medianRate === null || medianRate === 0) return [];

  const threshold = Math.max(medianRate * THRESHOLDS.daySpikeVsMedian, THRESHOLDS.daySpikeFloor);

  const medianDuration = median(
    days.map((d) => d.avgDeliveryMinutes).filter((v): v is number => v !== null),
  );

  const formatDay = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return days
    .filter((point) => rateOf(point) >= threshold)
    .map((point) => {
      const rate = rateOf(point);
      const slower =
        point.avgDeliveryMinutes !== null && medianDuration !== null
          ? point.avgDeliveryMinutes - medianDuration
          : null;

      return {
        id: `daily-delay-spike:${point.bucketStart.toISOString().slice(0, 10)}`,
        rule: 'daily-delay-spike' as const,
        severity: 'info' as const,
        title: `Delays spiked on ${formatDay.format(point.bucketStart)}`,
        message:
          `${pct(rate)} of that day's ${point.ordersCount} orders ran late against a window ` +
          `median of ${pct(medianRate)}` +
          (slower !== null && slower > 0
            ? `, and deliveries took ${slower.toFixed(0)} minutes longer than usual`
            : '') +
          `. A one-day disruption rather than a trend - worth excluding before reading the ` +
          `weekly average.`,
        entity: {
          kind: 'day' as const,
          id: point.bucketStart.toISOString().slice(0, 10),
          label: formatDay.format(point.bucketStart),
        },
        metric: 'delay_rate',
        value: rate,
        threshold,
        valueLabel: pct(rate),
        thresholdLabel: pct(threshold),
        detectedAt: point.bucketStart,
      };
    })
    .slice(0, 2);
}
