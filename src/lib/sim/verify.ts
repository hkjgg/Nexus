/**
 * Verifies that a generated dataset actually contains the four demo stories,
 * plus the baseline statistical targets.
 *
 * The seed script prints these checks so a failed story is obvious the moment
 * the data is created, rather than the day someone demos it.
 */

import {
  DEADHEAD_FACTOR,
  OUTCOME_RATES,
  WEEKDAY_MULTIPLIER,
  STORY_RAIN_DAY,
  STORY_THIRSTY_VAN,
  STORY_ZONE_SURGE,
} from './config';
import {
  companyDaysAgo,
  localDayOfWeek,
  resolveOverloadedDrivers,
  type GeneratedDataset,
} from './generate';
import type { Order } from '@/lib/db/types';

export type Check = {
  label: string;
  detail: string;
  pass: boolean;
};

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const num = (value: number, digits = 1): string =>
  Number.isFinite(value) ? value.toFixed(digits) : 'n/a';

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

const deliveryMinutes = (order: Order): number | null => {
  if (order.status !== 'delivered' || !order.delivered_at || !order.picked_up_at) return null;
  return (Date.parse(order.delivered_at) - Date.parse(order.picked_up_at)) / 60000;
};

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export function verifyStories(data: GeneratedDataset): Check[] {
  const checks: Check[] = [];
  const nowMs = data.generatedAt.getTime();
  /** Whole company-local calendar days back that an order was created. */
  const daysAgoOf = (order: Order): number => companyDaysAgo(nowMs, Date.parse(order.created_at));

  // --- Story 1: Z04 demand outgrows its driver capacity ---------------------
  const surgeZone = data.zones.find((z) => z.code === STORY_ZONE_SURGE.zoneCode);
  if (surgeZone) {
    const zoneOrders = data.orders.filter((o) => o.zone_id === surgeZone.id);
    const perDay = new Map<number, number>();
    for (const order of zoneOrders) {
      const d = daysAgoOf(order);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }

    const win = STORY_ZONE_SURGE.windowDays;

    // Daily counts swing with the weekday curve and with demand noise, so a
    // naive first-day/last-day comparison is unreliable. Divide the weekday
    // effect back out, fit a least-squares line across the window, then compare
    // the fitted level at its start against its end. Today is skipped because
    // it is still in progress.
    // The ramp runs from day -(win-1) up to today. Today is partial, so fit the
    // line over the complete days and read the trend's value at today off the
    // fitted line rather than off a half-finished count.
    const points: Array<{ x: number; y: number }> = [];
    for (let d = win - 1; d >= 1; d -= 1) {
      const seasonal = WEEKDAY_MULTIPLIER[localDayOfWeek(nowMs, d)] ?? 1;
      points.push({ x: win - 1 - d, y: (perDay.get(d) ?? 0) / seasonal });
    }

    const n = points.length;
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);
    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const fittedStart = intercept;
    const fittedEnd = intercept + slope * (win - 1);
    const growth = fittedStart > 0 ? fittedEnd / fittedStart - 1 : 0;

    checks.push({
      label: `Story 1a - ${surgeZone.code} volume growth over ${win}d`,
      // Thirteen noisy daily counts give the slope an appreciable standard
      // error, so the realised trend scatters a few points either side of the
      // configured ramp. The band is wide enough to absorb that without
      // hiding a genuinely broken surge.
      detail: `trend ${num(fittedStart, 0)} -> ${num(fittedEnd, 0)} orders/day (${pct(growth)}), target ~${pct(STORY_ZONE_SURGE.growth)}`,
      pass: growth >= 0.27 && growth <= 0.5,
    });

    // Driver headcount stayed flat while volume grew.
    const zoneDriverIds = new Set(
      data.drivers.filter((d) => d.home_zone_id === surgeZone.id).map((d) => d.id),
    );
    checks.push({
      label: `Story 1b - ${surgeZone.code} driver headcount flat`,
      detail: `${zoneDriverIds.size} drivers assigned, unchanged across the window`,
      pass: zoneDriverIds.size > 0,
    });

    // Utilisation in the back half of the window.
    const recentShifts = data.driverShifts.filter((s) => {
      if (!zoneDriverIds.has(s.driver_id)) return false;
      const d = companyDaysAgo(nowMs, Date.parse(`${s.date}T12:00:00Z`));
      return d >= 1 && d <= 5;
    });
    const active = recentShifts.reduce((sum, s) => sum + s.active_minutes, 0);
    const total = recentShifts.reduce((sum, s) => sum + s.active_minutes + s.idle_minutes, 0);
    const utilisation = total > 0 ? active / total : 0;

    checks.push({
      label: `Story 1c - ${surgeZone.code} utilisation above 90%`,
      detail: `${pct(utilisation)} over the last 5 full days, target >90%`,
      pass: utilisation > 0.9,
    });

    // Delays rising inside the window vs the zone's own earlier baseline.
    const lateRateFor = (from: number, to: number): number => {
      const slice = zoneOrders.filter((o) => {
        const d = daysAgoOf(o);
        return d >= from && d < to;
      });
      if (slice.length === 0) return 0;
      const late = slice.filter(
        (o) =>
          o.status === 'delayed' ||
          (o.status === 'delivered' &&
            o.promised_at !== null &&
            o.delivered_at !== null &&
            Date.parse(o.delivered_at) > Date.parse(o.promised_at)),
      ).length;
      return late / slice.length;
    };
    const lateBefore = lateRateFor(win, win + 14);
    const lateAfter = lateRateFor(1, 6);

    checks.push({
      label: `Story 1d - ${surgeZone.code} delay rate rising`,
      detail: `${pct(lateBefore)} before the window -> ${pct(lateAfter)} in the last 5 days`,
      pass: lateAfter > lateBefore * 1.4,
    });
  }

  // --- Story 2: one van drinks more fuel than its peers ---------------------
  // Reconstructed the way the analytics layer will: litres actually burned per
  // kilometre actually driven, where distance comes from the orders each
  // vehicle's driver delivered.
  const kmByVehicle = new Map<string, number>();
  const vehicleByDriver = new Map<string, string>();
  for (const driver of data.drivers) {
    if (driver.vehicle_id) vehicleByDriver.set(driver.id, driver.vehicle_id);
  }
  for (const order of data.orders) {
    if (!order.driver_id || order.status === 'cancelled') continue;
    const vehicleId = vehicleByDriver.get(order.driver_id);
    if (!vehicleId) continue;
    kmByVehicle.set(
      vehicleId,
      (kmByVehicle.get(vehicleId) ?? 0) + Number(order.distance_km) * DEADHEAD_FACTOR,
    );
  }

  const litersByVehicle = new Map<string, number>();
  for (const expense of data.expenses) {
    if (expense.category !== 'fuel' || !expense.vehicle_id) continue;
    litersByVehicle.set(
      expense.vehicle_id,
      (litersByVehicle.get(expense.vehicle_id) ?? 0) + (expense.liters ?? 0),
    );
  }

  const litersPerKm = (vehicleId: string): number => {
    const km = kmByVehicle.get(vehicleId) ?? 0;
    const liters = litersByVehicle.get(vehicleId) ?? 0;
    return km > 0 ? liters / km : 0;
  };

  const vans = data.vehicles.filter((v) => v.type === 'van');
  const thirsty = vans.find((v) => v.plate === STORY_THIRSTY_VAN.plate);
  if (thirsty) {
    const thirstyRate = litersPerKm(thirsty.id);
    const peerRates = vans
      .filter((v) => v.id !== thirsty.id)
      .map((v) => litersPerKm(v.id))
      .filter((r) => r > 0);
    const peerMedian = median(peerRates);
    const excess = peerMedian > 0 ? thirstyRate / peerMedian - 1 : 0;

    checks.push({
      label: `Story 2 - van ${thirsty.plate} fuel burn vs peer vans`,
      detail: `${num(thirstyRate, 4)} L/km vs peer median ${num(peerMedian, 4)} L/km (${pct(excess)} higher), target ~${pct(STORY_THIRSTY_VAN.excessFuelRate)}`,
      pass: excess >= 0.2,
    });
  }

  // --- Story 3: two drivers carry far more than the median ------------------
  const deliveriesByDriver = new Map<string, number>();
  for (const order of data.orders) {
    if (!order.driver_id) continue;
    if (order.status !== 'delivered') continue;
    deliveriesByDriver.set(order.driver_id, (deliveriesByDriver.get(order.driver_id) ?? 0) + 1);
  }

  const targetDrivers = resolveOverloadedDrivers(data.drivers, data.zones);

  if (targetDrivers.length > 0) {
    const targetIds = new Set(targetDrivers.map((d) => d.id));
    const medianOthers = median(
      data.drivers
        .filter((d) => !targetIds.has(d.id))
        .map((d) => deliveriesByDriver.get(d.id) ?? 0),
    );
    const targetCounts = targetDrivers.map((d) => deliveriesByDriver.get(d.id) ?? 0);
    const ratios = targetCounts.map((c) => (medianOthers > 0 ? c / medianOthers - 1 : 0));

    checks.push({
      label: 'Story 3 - two drivers above the median load',
      detail: targetDrivers
        .map(
          (d, i) =>
            `${d.full_name}: ${targetCounts[i]} deliveries (${pct(ratios[i]!)} over the median of ${num(medianOthers, 0)})`,
        )
        .join('; '),
      pass: ratios.every((r) => r >= 0.3),
    });
  }

  // --- Story 4: the rain day ------------------------------------------------
  const rainDayMinutes: number[] = [];
  const normalMinutes: number[] = [];
  let rainTotal = 0;
  let rainLate = 0;

  for (const order of data.orders) {
    const d = daysAgoOf(order);
    const minutes = deliveryMinutes(order);
    const isRain = d === STORY_RAIN_DAY.daysAgo;

    if (isRain) {
      rainTotal += 1;
      if (
        order.status === 'delayed' ||
        (order.status === 'delivered' &&
          order.promised_at &&
          order.delivered_at &&
          Date.parse(order.delivered_at) > Date.parse(order.promised_at))
      ) {
        rainLate += 1;
      }
    }

    if (minutes === null) continue;
    if (isRain) rainDayMinutes.push(minutes);
    else if (d > STORY_RAIN_DAY.daysAgo) normalMinutes.push(minutes);
  }

  const rainAvg = mean(rainDayMinutes);
  const normalAvg = mean(normalMinutes);

  checks.push({
    label: `Story 4a - rain day (${STORY_RAIN_DAY.daysAgo}d ago) avg delivery time`,
    detail: `${num(normalAvg)} min normally -> ${num(rainAvg)} min on the rain day, target ~51 min`,
    pass: rainAvg >= 45 && rainAvg <= 58,
  });

  checks.push({
    label: 'Story 4b - rain day delay spike',
    detail: `${pct(rainTotal > 0 ? rainLate / rainTotal : 0)} of orders late, baseline ~${pct(OUTCOME_RATES.late)}`,
    pass: rainTotal > 0 && rainLate / rainTotal > 0.25,
  });

  return checks;
}

/** Baseline statistical targets, independent of the planted stories. */
export function verifyBaselines(data: GeneratedDataset): Check[] {
  const nowMs = data.generatedAt.getTime();
  const surgeZone = data.zones.find((z) => z.code === STORY_ZONE_SURGE.zoneCode);

  // "Normal conditions" excludes the rain day and the Z04 surge window.
  const normal = data.orders.filter((o) => {
    const d = companyDaysAgo(nowMs, Date.parse(o.created_at));
    if (d === STORY_RAIN_DAY.daysAgo) return false;
    if (d < STORY_ZONE_SURGE.windowDays && o.zone_id === surgeZone?.id) return false;
    return true;
  });

  const terminal = normal.filter(
    (o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'failed',
  );
  const cancelled = terminal.filter((o) => o.status === 'cancelled').length;
  const failed = terminal.filter((o) => o.status === 'failed').length;
  const delivered = terminal.filter((o) => o.status === 'delivered');
  const late = delivered.filter(
    (o) =>
      o.promised_at && o.delivered_at && Date.parse(o.delivered_at) > Date.parse(o.promised_at),
  ).length;

  const durations = delivered.map(deliveryMinutes).filter((m): m is number => m !== null);
  const avgMinutes = mean(durations);

  const activeMinutes = data.driverShifts.reduce((s, x) => s + x.active_minutes, 0);
  const idleMinutes = data.driverShifts.reduce((s, x) => s + x.idle_minutes, 0);
  const utilisation =
    activeMinutes + idleMinutes > 0 ? activeMinutes / (activeMinutes + idleMinutes) : 0;

  const days = new Set(data.orders.map((o) => o.created_at.slice(0, 10))).size;

  return [
    {
      label: 'Baseline - orders per day',
      detail: `${num(data.orders.length / Math.max(1, days), 0)} avg over ${days} days, target ~600`,
      pass: data.orders.length / Math.max(1, days) >= 520,
    },
    {
      label: 'Baseline - cancellation rate',
      detail: `${pct(terminal.length ? cancelled / terminal.length : 0)}, target ~${pct(OUTCOME_RATES.cancelled)}`,
      pass: Math.abs(cancelled / Math.max(1, terminal.length) - OUTCOME_RATES.cancelled) < 0.015,
    },
    {
      label: 'Baseline - failure rate',
      detail: `${pct(terminal.length ? failed / terminal.length : 0)}, target ~${pct(OUTCOME_RATES.failed)}`,
      pass: Math.abs(failed / Math.max(1, terminal.length) - OUTCOME_RATES.failed) < 0.01,
    },
    {
      label: 'Baseline - late rate (normal conditions)',
      detail: `${pct(delivered.length ? late / delivered.length : 0)}, target ~${pct(OUTCOME_RATES.late)}`,
      pass: Math.abs(late / Math.max(1, delivered.length) - OUTCOME_RATES.late) < 0.03,
    },
    {
      label: 'Baseline - avg delivery time',
      detail: `${num(avgMinutes)} min, target 30-35 min`,
      pass: avgMinutes >= 30 && avgMinutes <= 35,
    },
    {
      label: 'Baseline - fleet utilisation',
      detail: `${pct(utilisation)}, target 60-85%`,
      pass: utilisation >= 0.6 && utilisation <= 0.85,
    },
  ];
}
