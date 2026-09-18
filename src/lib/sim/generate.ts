/**
 * The NEXUS demo data engine.
 *
 * Produces a complete, reproducible 90-day operating history for one
 * fictional company. Generation is pure: it touches no database and no
 * network, so it can be dry-run and asserted against in tests.
 *
 * "Reproducible" means: the same seed on the same calendar day yields
 * byte-identical data. The history is deliberately anchored to the present so
 * the demo always looks live, which means re-seeding tomorrow shifts the whole
 * window by a day. Pass `options.now` to pin it. Persisting the
 * result is the seed script's job.
 *
 * The output deliberately contains four discoverable patterns - see
 * `config.ts` and `verifyStories` below.
 */

import {
  ACTIVE_MINUTES_PER_ORDER,
  BASE_ORDERS_PER_DAY,
  CANCEL_REASONS,
  CITY_CENTER,
  COMPANY,
  DAILY_NOISE_STDDEV,
  DAILY_OVERHEAD,
  DEADHEAD_FACTOR,
  DRIVER_COST_PER_HOUR,
  DRIVER_TOTAL,
  DURATION,
  FAILURE_REASONS,
  FLEET,
  FUEL_PRICE_PER_LITER,
  HISTORY_DAYS,
  HOURLY_DEMAND_CURVE,
  LEAD_TIMES,
  MAX_UTILISATION,
  ORDER_CHANNELS,
  ORDER_CHANNEL_WEIGHTS,
  OUTCOME_RATES,
  PRICING,
  ROSTER_RATE,
  SIM_SEED,
  SLA_MINUTES,
  STORY_OVERLOADED_DRIVERS,
  STORY_RAIN_DAY,
  STORY_THIRSTY_VAN,
  STORY_ZONE_SURGE,
  VEHICLE_SPECS,
  WEEKDAY_MULTIPLIER,
} from './config';
import { distanceKm, hexagonPolygon, randomPointNear } from './geo';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { createRng, type Rng } from './rng';
import { TOTAL_DEMAND_WEIGHT, ZONE_SPECS } from './zones';
import type {
  Alert,
  Company,
  Driver,
  DriverShift,
  Expense,
  Order,
  OrderChannel,
  OrderEvent,
  OrderStatus,
  Vehicle,
  VehicleType,
  Zone,
} from '@/lib/db/types';

/**
 * The demo clock runs at a fixed offset from UTC. Real Beirut time shifts with
 * DST; pinning the offset keeps generation deterministic, and the difference
 * is invisible in a demo. All stored timestamps remain UTC.
 */
export const COMPANY_UTC_OFFSET_HOURS = 3;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type GeneratedDataset = {
  company: Company;
  zones: Zone[];
  vehicles: Vehicle[];
  drivers: Driver[];
  orders: Order[];
  orderEvents: OrderEvent[];
  driverShifts: DriverShift[];
  expenses: Expense[];
  alerts: Alert[];
  /** The instant the dataset was generated for; the history ends here. */
  generatedAt: Date;
};

export type GenerateOptions = {
  seed?: string;
  /** Overrides "now". Useful for tests that need a fixed history window. */
  now?: Date;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const iso = (ms: number): string => new Date(ms).toISOString();

const money = (value: number): number =>
  Math.round(value * 10 ** PRICING.decimals) / 10 ** PRICING.decimals;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The UTC date key (YYYY-MM-DD) a timestamp falls on. */
const dateKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function bearingOffset(
  lat: number,
  lng: number,
  bearingDeg: number,
  distKm: number,
): { lat: number; lng: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (distKm * Math.cos(rad)) / 111.32;
  const dLng = (distKm * Math.sin(rad)) / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

// ---------------------------------------------------------------------------
// Entity builders
// ---------------------------------------------------------------------------

function buildZones(rng: Rng, companyId: string, createdAt: string): Zone[] {
  return ZONE_SPECS.map((spec) => {
    const center =
      spec.offsetKm === 0
        ? { lat: CITY_CENTER.lat, lng: CITY_CENTER.lng }
        : bearingOffset(CITY_CENTER.lat, CITY_CENTER.lng, spec.bearingDeg, spec.offsetKm);

    return {
      id: rng.uuid(),
      company_id: companyId,
      name: spec.name,
      code: spec.code,
      polygon: hexagonPolygon(center.lat, center.lng, spec.radiusKm, rng),
      center_lat: round2(center.lat * 1e4) / 1e4,
      center_lng: round2(center.lng * 1e4) / 1e4,
      base_demand_weight: spec.demandWeight,
      created_at: createdAt,
    };
  });
}

function buildVehicles(rng: Rng, companyId: string, createdAt: string): Vehicle[] {
  const vehicles: Vehicle[] = [];
  const plan: Array<[VehicleType, number, string]> = [
    ['motorbike', FLEET.motorbike, 'M'],
    ['van', FLEET.van, 'V'],
    ['truck', FLEET.truck, 'T'],
  ];

  for (const [type, count, letter] of plan) {
    const spec = VEHICLE_SPECS[type];
    for (let i = 1; i <= count; i += 1) {
      const plate = `SP-${letter}${String(i).padStart(2, '0')}`;
      // A couple of vehicles sit in maintenance or idle, as in any real fleet.
      const roll = rng.next();
      const status = roll < 0.05 ? 'maintenance' : roll < 0.1 ? 'idle' : 'active';

      vehicles.push({
        id: rng.uuid(),
        company_id: companyId,
        plate,
        type,
        fuel_type: spec.fuelType,
        fuel_efficiency_km_per_l: round2(
          rng.float(spec.efficiencyKmPerL[0], spec.efficiencyKmPerL[1]),
        ),
        fixed_cost_per_day: round2(rng.float(spec.fixedCostPerDay[0], spec.fixedCostPerDay[1])),
        status,
        odometer_km: round2(rng.float(4_000, 92_000)),
        created_at: createdAt,
      });
    }
  }

  return vehicles;
}

/** Shift patterns, all nine hours long so utilisation is comparable. */
const SHIFT_PATTERNS: ReadonlyArray<{ start: string; end: string; startHour: number }> = [
  { start: '08:00', end: '17:00', startHour: 8 },
  { start: '10:00', end: '19:00', startHour: 10 },
  { start: '12:00', end: '21:00', startHour: 12 },
  { start: '14:00', end: '23:00', startHour: 14 },
];

const SHIFT_MINUTES = 9 * 60;

type DriverPlan = {
  driver: Driver;
  zoneIndex: number;
  shiftStartHour: number;
  /** Relative share of their zone's orders. >1 means overloaded. */
  loadWeight: number;
};

function buildDrivers(
  rng: Rng,
  companyId: string,
  createdAt: string,
  zones: Zone[],
  vehicles: Vehicle[],
): DriverPlan[] {
  // Allocate drivers across zones in proportion to demand, guaranteeing at
  // least two per zone so no zone is left uncovered.
  const allocation = ZONE_SPECS.map((spec) =>
    Math.max(2, Math.round((DRIVER_TOTAL * spec.demandWeight) / TOTAL_DEMAND_WEIGHT)),
  );

  // The surge zone is pinned below its fair share - see STORY_ZONE_SURGE.
  const surgeIndex = ZONE_SPECS.findIndex((spec) => spec.code === STORY_ZONE_SURGE.zoneCode);
  if (surgeIndex >= 0) allocation[surgeIndex] = STORY_ZONE_SURGE.driverCount;

  // Reconcile rounding drift against the exact headcount, leaving the pinned
  // surge zone alone.
  let allocated = allocation.reduce((a, b) => a + b, 0);
  let cursor = 0;
  while (allocated !== DRIVER_TOTAL && cursor < 1000) {
    const i = cursor % allocation.length;
    cursor += 1;
    if (i === surgeIndex) continue;
    if (allocated > DRIVER_TOTAL && allocation[i]! > 2) {
      allocation[i] -= 1;
      allocated -= 1;
    } else if (allocated < DRIVER_TOTAL) {
      allocation[i] += 1;
      allocated += 1;
    }
  }

  const usedNames = new Set<string>();
  const plans: DriverPlan[] = [];
  let index = 0;

  for (let zoneIndex = 0; zoneIndex < allocation.length; zoneIndex += 1) {
    for (let n = 0; n < allocation[zoneIndex]!; n += 1) {
      let fullName = '';
      do {
        fullName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      const pattern = SHIFT_PATTERNS[index % SHIFT_PATTERNS.length]!;
      const vehicle = vehicles[index % vehicles.length]!;
      const zone = zones[zoneIndex]!;
      const isOverloaded = STORY_OVERLOADED_DRIVERS.drivers.some(
        (d) => d.zoneCode === ZONE_SPECS[zoneIndex]!.code && d.slot === n,
      );

      plans.push({
        driver: {
          id: rng.uuid(),
          company_id: companyId,
          full_name: fullName,
          phone: `+961 ${rng.int(70, 79)} ${String(rng.int(100, 999))} ${String(rng.int(100, 999))}`,
          home_zone_id: zone.id,
          vehicle_id: vehicle.id,
          shift_start: pattern.start,
          shift_end: pattern.end,
          cost_per_hour: round2(rng.float(DRIVER_COST_PER_HOUR[0], DRIVER_COST_PER_HOUR[1])),
          status: 'off_shift',
          current_lat: null,
          current_lng: null,
          created_at: createdAt,
        },
        zoneIndex,
        shiftStartHour: pattern.startHour,
        loadWeight: isOverloaded ? STORY_OVERLOADED_DRIVERS.loadWeight : 1,
      });

      index += 1;
    }
  }

  return plans;
}

// ---------------------------------------------------------------------------
// Demand model
// ---------------------------------------------------------------------------

/** Demand multiplier for a zone on a given day, including the surge story. */
function zoneDemandMultiplier(zoneCode: string, daysAgo: number): number {
  if (zoneCode !== STORY_ZONE_SURGE.zoneCode) return 1;
  const lastIndex = STORY_ZONE_SURGE.windowDays - 1;
  if (daysAgo > lastIndex) return 1;
  // Linear ramp: flat at the start of the window, +growth by today.
  const progress = (lastIndex - daysAgo) / lastIndex;
  return 1 + STORY_ZONE_SURGE.growth * progress;
}

/** Late-delivery probability for a zone on a given day. */
function lateRateFor(zoneCode: string, daysAgo: number): number {
  if (daysAgo === STORY_RAIN_DAY.daysAgo) return STORY_RAIN_DAY.lateRate;

  if (zoneCode === STORY_ZONE_SURGE.zoneCode) {
    const lastIndex = STORY_ZONE_SURGE.windowDays - 1;
    if (daysAgo <= lastIndex) {
      const progress = (lastIndex - daysAgo) / lastIndex;
      // Delays climb alongside demand: capacity is not keeping up.
      return (
        OUTCOME_RATES.late + (STORY_ZONE_SURGE.peakLateRate - OUTCOME_RATES.late) * progress
      );
    }
  }

  return OUTCOME_RATES.late;
}

/** Picks an hour of the local day from the demand curve. */
function pickLocalHour(rng: Rng): number {
  const hours = HOURLY_DEMAND_CURVE.map((_, h) => h);
  return rng.weighted(hours, HOURLY_DEMAND_CURVE);
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateDataset(options: GenerateOptions = {}): GeneratedDataset {
  const rng = createRng(options.seed ?? SIM_SEED);
  const now = options.now ?? new Date();
  const nowMs = now.getTime();

  // Midnight (company-local) of today, expressed in UTC milliseconds.
  const localNow = nowMs + COMPANY_UTC_OFFSET_HOURS * HOUR_MS;
  const todayLocalMidnightUtc =
    Math.floor(localNow / DAY_MS) * DAY_MS - COMPANY_UTC_OFFSET_HOURS * HOUR_MS;

  const historyStart = todayLocalMidnightUtc - (HISTORY_DAYS - 1) * DAY_MS;
  const companyCreatedAt = iso(historyStart - 30 * DAY_MS);

  const company: Company = {
    id: rng.uuid(),
    name: COMPANY.name,
    currency: COMPANY.currency,
    timezone: COMPANY.timezone,
    is_demo: true,
    created_at: companyCreatedAt,
  };

  const zones = buildZones(rng, company.id, companyCreatedAt);
  const vehicles = buildVehicles(rng, company.id, companyCreatedAt);
  const driverPlans = buildDrivers(rng, company.id, companyCreatedAt, zones, vehicles);
  const drivers = driverPlans.map((p) => p.driver);

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const driversByZone = new Map<number, DriverPlan[]>();
  driverPlans.forEach((plan) => {
    const list = driversByZone.get(plan.zoneIndex) ?? [];
    list.push(plan);
    driversByZone.set(plan.zoneIndex, list);
  });

  const orders: Order[] = [];
  const orderEvents: OrderEvent[] = [];
  const driverShifts: DriverShift[] = [];
  const expenses: Expense[] = [];

  let orderSeq = 0;

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const dayStartUtc = todayLocalMidnightUtc - daysAgo * DAY_MS;
    if (dayStartUtc > nowMs) continue;

    const localDow = new Date(dayStartUtc + COMPANY_UTC_OFFSET_HOURS * HOUR_MS).getUTCDay();
    const weekdayMultiplier = WEEKDAY_MULTIPLIER[localDow]!;
    const dailyNoise = Math.max(0.7, rng.normal(1, DAILY_NOISE_STDDEV));
    const isRainDay = daysAgo === STORY_RAIN_DAY.daysAgo;

    // --- roster -----------------------------------------------------------
    const rostered = driverPlans.filter(() => rng.bool(ROSTER_RATE));
    const rosteredByZone = new Map<number, DriverPlan[]>();
    rostered.forEach((plan) => {
      const list = rosteredByZone.get(plan.zoneIndex) ?? [];
      list.push(plan);
      rosteredByZone.set(plan.zoneIndex, list);
    });

    /** Deliveries handled per driver today, used for shifts and wages. */
    const deliveriesPerDriver = new Map<string, number>();
    /** Kilometres driven per vehicle today, used for fuel. */
    const kmPerVehicle = new Map<string, number>();

    // --- orders -----------------------------------------------------------
    for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
      const zone = zones[zoneIndex]!;
      const spec = ZONE_SPECS[zoneIndex]!;

      const zoneOrderCount = Math.max(
        0,
        Math.round(
          BASE_ORDERS_PER_DAY *
            weekdayMultiplier *
            dailyNoise *
            (spec.demandWeight / TOTAL_DEMAND_WEIGHT) *
            zoneDemandMultiplier(spec.code, daysAgo),
        ),
      );

      const lateRate = lateRateFor(spec.code, daysAgo);
      const cancelRate = isRainDay ? STORY_RAIN_DAY.cancelRate : OUTCOME_RATES.cancelled;

      const pool = rosteredByZone.get(zoneIndex) ?? rostered;
      const poolWeights = pool.map((p) => p.loadWeight);

      for (let i = 0; i < zoneOrderCount; i += 1) {
        orderSeq += 1;

        const localHour = pickLocalHour(rng);
        const createdAtMs =
          dayStartUtc + localHour * HOUR_MS + Math.floor(rng.float(0, 60)) * MINUTE_MS;

        // Today is still in progress: nothing is placed in the future.
        if (createdAtMs > nowMs) continue;

        const pickup = randomPointNear(zone.center_lat, zone.center_lng, spec.radiusKm * 0.5, rng);
        const dropoff = randomPointNear(zone.center_lat, zone.center_lng, spec.radiusKm, rng);
        const straightKm = distanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
        // Roads are never straight.
        const distance = round2(Math.max(0.4, straightKm * rng.float(1.2, 1.55)));

        const channel = rng.weighted(
          ORDER_CHANNELS as readonly OrderChannel[],
          ORDER_CHANNEL_WEIGHTS,
        );
        const fee = money(PRICING.baseFee + distance * PRICING.feePerKm);
        const promisedAtMs = createdAtMs + SLA_MINUTES * MINUTE_MS;

        const assignedAtMs =
          createdAtMs +
          rng.float(LEAD_TIMES.assignMinMinutes, LEAD_TIMES.assignMaxMinutes) * MINUTE_MS;
        const pickedUpAtMs =
          assignedAtMs +
          rng.float(LEAD_TIMES.pickupMinMinutes, LEAD_TIMES.pickupMaxMinutes) * MINUTE_MS;
        const transitAtMs =
          pickedUpAtMs +
          rng.float(LEAD_TIMES.transitMinMinutes, LEAD_TIMES.transitMaxMinutes) * MINUTE_MS;

        // Delivery duration, before lateness and weather.
        let durationMin =
          (DURATION.baseMinutes + distance * DURATION.minutesPerKm) *
          spec.trafficFactor *
          Math.max(0.6, rng.normal(1, DURATION.noiseStdDev));

        const willBeLate = rng.bool(lateRate);
        if (willBeLate) {
          durationMin *= rng.float(DURATION.lateMultiplierMin, DURATION.lateMultiplierMax);
        }
        if (isRainDay) {
          durationMin *= STORY_RAIN_DAY.durationMultiplier;
        }

        const deliveredAtMs = transitAtMs + durationMin * MINUTE_MS;

        // Terminal outcome, drawn before clamping to "now".
        const outcomeRoll = rng.next();
        const isCancelled = outcomeRoll < cancelRate;
        const isFailed = !isCancelled && outcomeRoll < cancelRate + OUTCOME_RATES.failed;

        const assignedDriver =
          pool.length > 0 ? rng.weighted(pool, poolWeights) : rng.pick(driverPlans);

        let status: OrderStatus;
        let assignedAt: number | null = assignedAtMs;
        let pickedUpAt: number | null = pickedUpAtMs;
        let deliveredAt: number | null = null;
        let cancelledAt: number | null = null;
        let cancelReason: string | null = null;
        let driverId: string | null = assignedDriver.driver.id;

        if (isCancelled) {
          // Cancellations happen between placement and pickup.
          cancelledAt = createdAtMs + rng.float(1, 20) * MINUTE_MS;
          status = 'cancelled';
          cancelReason = rng.pick(CANCEL_REASONS);
          if (cancelledAt < assignedAtMs) {
            assignedAt = null;
            driverId = null;
          }
          pickedUpAt = null;
        } else if (isFailed) {
          status = 'failed';
          cancelReason = rng.pick(FAILURE_REASONS);
          cancelledAt = deliveredAtMs;
        } else {
          status = 'delivered';
          deliveredAt = deliveredAtMs;
        }

        // Clamp the lifecycle against the present moment: orders still in
        // flight right now must not carry future timestamps.
        if (status !== 'cancelled' || (cancelledAt ?? 0) > nowMs) {
          if (assignedAtMs > nowMs) {
            status = 'pending';
            assignedAt = null;
            pickedUpAt = null;
            deliveredAt = null;
            cancelledAt = null;
            cancelReason = null;
            driverId = null;
          } else if (pickedUpAtMs > nowMs) {
            status = 'assigned';
            pickedUpAt = null;
            deliveredAt = null;
            cancelledAt = null;
            cancelReason = null;
          } else if (transitAtMs > nowMs) {
            status = 'picked_up';
            deliveredAt = null;
            cancelledAt = null;
            cancelReason = null;
          } else if ((status === 'delivered' ? deliveredAtMs : (cancelledAt ?? 0)) > nowMs) {
            status = 'in_transit';
            deliveredAt = null;
            cancelledAt = null;
            cancelReason = null;
          }
        }

        // An order still out past its promised time is flagged as delayed.
        const inFlight =
          status === 'pending' ||
          status === 'assigned' ||
          status === 'picked_up' ||
          status === 'in_transit';
        if (inFlight && nowMs > promisedAtMs) {
          status = 'delayed';
        }

        const order: Order = {
          id: rng.uuid(),
          company_id: company.id,
          order_number: `SP-${String(orderSeq).padStart(7, '0')}`,
          zone_id: zone.id,
          driver_id: driverId,
          status,
          channel,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          distance_km: distance,
          delivery_fee: fee,
          promised_at: iso(promisedAtMs),
          assigned_at: assignedAt === null ? null : iso(assignedAt),
          picked_up_at: pickedUpAt === null ? null : iso(pickedUpAt),
          delivered_at: deliveredAt === null ? null : iso(deliveredAt),
          cancelled_at: cancelledAt === null ? null : iso(cancelledAt),
          cancel_reason: cancelReason,
          created_at: iso(createdAtMs),
        };
        orders.push(order);

        // --- event trail ---------------------------------------------------
        const pushEvent = (
          eventType: string,
          from: OrderStatus | null,
          to: OrderStatus | null,
          atMs: number,
          meta: Record<string, unknown> = {},
        ) => {
          if (atMs > nowMs) return;
          orderEvents.push({
            id: rng.uuid(),
            company_id: company.id,
            order_id: order.id,
            event_type: eventType,
            from_status: from,
            to_status: to,
            occurred_at: iso(atMs),
            meta,
            created_at: iso(atMs),
          });
        };

        pushEvent('order_placed', null, 'pending', createdAtMs, { channel });
        if (order.assigned_at) {
          pushEvent('driver_assigned', 'pending', 'assigned', assignedAtMs, {
            driver_id: driverId,
          });
        }
        if (order.picked_up_at) {
          pushEvent('picked_up', 'assigned', 'picked_up', pickedUpAtMs);
          if (transitAtMs <= nowMs) {
            pushEvent('in_transit', 'picked_up', 'in_transit', transitAtMs);
          }
        }
        if (order.status === 'delivered' && deliveredAt !== null) {
          const lateBy = Math.round((deliveredAt - promisedAtMs) / MINUTE_MS);
          pushEvent('delivered', 'in_transit', 'delivered', deliveredAt, {
            minutes_vs_promise: lateBy,
            on_time: lateBy <= 0,
          });
        }
        if (order.status === 'cancelled' && cancelledAt !== null) {
          pushEvent('cancelled', order.assigned_at ? 'assigned' : 'pending', 'cancelled', cancelledAt, {
            reason: cancelReason,
          });
        }
        if (order.status === 'failed' && cancelledAt !== null) {
          pushEvent('failed', 'in_transit', 'failed', cancelledAt, { reason: cancelReason });
        }
        if (order.status === 'delayed') {
          pushEvent('sla_breached', null, 'delayed', promisedAtMs, {
            promised_at: iso(promisedAtMs),
          });
        }

        // --- workload attribution -------------------------------------------
        if (driverId && order.status !== 'cancelled') {
          deliveriesPerDriver.set(driverId, (deliveriesPerDriver.get(driverId) ?? 0) + 1);
          const vehicleId = assignedDriver.driver.vehicle_id;
          if (vehicleId) {
            kmPerVehicle.set(
              vehicleId,
              (kmPerVehicle.get(vehicleId) ?? 0) + distance * DEADHEAD_FACTOR,
            );
          }
        }
      }
    }

    // --- shifts -------------------------------------------------------------
    const dayDate = dateKey(dayStartUtc + COMPANY_UTC_OFFSET_HOURS * HOUR_MS);

    for (const plan of rostered) {
      const deliveries = deliveriesPerDriver.get(plan.driver.id) ?? 0;
      const startedAtMs = dayStartUtc + (plan.shiftStartHour - COMPANY_UTC_OFFSET_HOURS) * HOUR_MS;
      const endedAtMs = startedAtMs + SHIFT_MINUTES * MINUTE_MS;

      // Utilisation emerges from workload rather than being written directly,
      // which is what makes the Z04 capacity story discoverable.
      const rawActive = deliveries * ACTIVE_MINUTES_PER_ORDER * rng.float(0.94, 1.06);
      const activeMinutes = Math.round(Math.min(rawActive, SHIFT_MINUTES * MAX_UTILISATION));

      // A shift that has not finished yet only counts elapsed minutes.
      const elapsedMinutes =
        endedAtMs > nowMs
          ? Math.max(0, Math.round((nowMs - startedAtMs) / MINUTE_MS))
          : SHIFT_MINUTES;
      const cappedActive = Math.min(activeMinutes, elapsedMinutes);

      driverShifts.push({
        id: rng.uuid(),
        company_id: company.id,
        driver_id: plan.driver.id,
        date: dayDate,
        started_at: startedAtMs > nowMs ? null : iso(startedAtMs),
        ended_at: endedAtMs > nowMs ? null : iso(endedAtMs),
        active_minutes: cappedActive,
        idle_minutes: Math.max(0, elapsedMinutes - cappedActive),
        created_at: iso(startedAtMs),
      });

      // Wages are paid on the hours worked.
      const wageMs = Math.min(endedAtMs, nowMs);
      if (elapsedMinutes > 0) {
        expenses.push({
          id: rng.uuid(),
          company_id: company.id,
          category: 'driver_wage',
          vehicle_id: null,
          driver_id: plan.driver.id,
          amount: money((elapsedMinutes / 60) * plan.driver.cost_per_hour),
          liters: null,
          occurred_at: iso(wageMs),
          created_at: iso(wageMs),
        });
      }
    }

    // --- vehicle costs ------------------------------------------------------
    const endOfDayMs = Math.min(dayStartUtc + 22 * HOUR_MS, nowMs);

    for (const vehicle of vehicles) {
      const km = kmPerVehicle.get(vehicle.id) ?? 0;

      if (km > 0) {
        // The thirsty van burns more fuel than its registered efficiency
        // implies. The spec sheet looks fine; the pump tells a different story.
        const excess =
          vehicle.plate === STORY_THIRSTY_VAN.plate ? 1 + STORY_THIRSTY_VAN.excessFuelRate : 1;
        const liters = (km / vehicle.fuel_efficiency_km_per_l) * excess * rng.float(0.97, 1.03);

        expenses.push({
          id: rng.uuid(),
          company_id: company.id,
          category: 'fuel',
          vehicle_id: vehicle.id,
          driver_id: null,
          amount: money(liters * FUEL_PRICE_PER_LITER),
          liters: round2(liters),
          occurred_at: iso(endOfDayMs),
          created_at: iso(endOfDayMs),
        });
      }

      expenses.push({
        id: rng.uuid(),
        company_id: company.id,
        category: 'vehicle_fixed',
        vehicle_id: vehicle.id,
        driver_id: null,
        amount: vehicle.fixed_cost_per_day,
        liters: null,
        occurred_at: iso(endOfDayMs),
        created_at: iso(endOfDayMs),
      });
    }

    // Maintenance is billed weekly, staggered so it does not all land at once.
    for (let v = 0; v < vehicles.length; v += 1) {
      const vehicle = vehicles[v]!;
      if (daysAgo % 7 !== v % 7) continue;
      const spec = VEHICLE_SPECS[vehicle.type];
      expenses.push({
        id: rng.uuid(),
        company_id: company.id,
        category: 'maintenance',
        vehicle_id: vehicle.id,
        driver_id: null,
        amount: money(rng.float(spec.maintenancePerWeek[0], spec.maintenancePerWeek[1])),
        liters: null,
        occurred_at: iso(endOfDayMs),
        created_at: iso(endOfDayMs),
      });
    }

    expenses.push({
      id: rng.uuid(),
      company_id: company.id,
      category: 'overhead',
      vehicle_id: null,
      driver_id: null,
      amount: money(rng.float(DAILY_OVERHEAD[0], DAILY_OVERHEAD[1])),
      liters: null,
      occurred_at: iso(endOfDayMs),
      created_at: iso(endOfDayMs),
    });
  }

  // --- live driver positions -------------------------------------------------
  // Drivers on an active shift right now get a plausible current location.
  const nowLocalHour = new Date(nowMs + COMPANY_UTC_OFFSET_HOURS * HOUR_MS).getUTCHours();
  for (const plan of driverPlans) {
    const onShift =
      nowLocalHour >= plan.shiftStartHour && nowLocalHour < plan.shiftStartHour + 9;
    if (!onShift) continue;
    const zone = zones[plan.zoneIndex]!;
    const spec = ZONE_SPECS[plan.zoneIndex]!;
    const point = randomPointNear(zone.center_lat, zone.center_lng, spec.radiusKm, rng);
    plan.driver.status = rng.bool(0.12) ? 'on_break' : 'on_shift';
    plan.driver.current_lat = point.lat;
    plan.driver.current_lng = point.lng;
  }

  const alerts = buildAlerts(rng, company.id, zones, vehicles, drivers, nowMs);

  return {
    company,
    zones,
    vehicles,
    drivers,
    orders,
    orderEvents,
    driverShifts,
    expenses,
    alerts,
    generatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

function buildAlerts(
  rng: Rng,
  companyId: string,
  zones: Zone[],
  vehicles: Vehicle[],
  drivers: Driver[],
  nowMs: number,
): Alert[] {
  const surgeZone = zones.find((z) => z.code === STORY_ZONE_SURGE.zoneCode);
  const thirstyVan = vehicles.find((v) => v.plate === STORY_THIRSTY_VAN.plate);
  const busiest = resolveOverloadedDrivers(drivers, zones);

  const alerts: Alert[] = [];

  if (surgeZone) {
    alerts.push({
      id: rng.uuid(),
      company_id: companyId,
      type: 'capacity',
      severity: 'critical',
      title: `${surgeZone.code} driver capacity exceeded`,
      message: `Order volume in ${surgeZone.name} (${surgeZone.code}) has grown sharply over the last ${STORY_ZONE_SURGE.windowDays} days while assigned driver headcount has not changed. Utilisation is above the safe ceiling and delays are climbing.`,
      entity_type: 'zone',
      entity_id: surgeZone.id,
      metric: 'fleet_utilization',
      value: 0.94,
      threshold: 0.9,
      resolved_at: null,
      created_at: iso(nowMs - 2 * HOUR_MS),
    });
  }

  if (thirstyVan) {
    alerts.push({
      id: rng.uuid(),
      company_id: companyId,
      type: 'fleet',
      severity: 'warning',
      title: `${thirstyVan.plate} fuel consumption above fleet norm`,
      message: `Van ${thirstyVan.plate} is consuming materially more fuel per kilometre than the other vans, despite a comparable registered efficiency. Worth a mechanical inspection.`,
      entity_type: 'vehicle',
      entity_id: thirstyVan.id,
      metric: 'liters_per_km',
      value: round2((1 / thirstyVan.fuel_efficiency_km_per_l) * (1 + STORY_THIRSTY_VAN.excessFuelRate) * 1000) / 1000,
      threshold: round2((1 / thirstyVan.fuel_efficiency_km_per_l) * 1000) / 1000,
      resolved_at: null,
      created_at: iso(nowMs - 26 * HOUR_MS),
    });
  }

  alerts.push({
    id: rng.uuid(),
    company_id: companyId,
    type: 'operational',
    severity: 'critical',
    title: 'Severe weather disrupted deliveries',
    message:
      'Heavy rain caused a fleet-wide slowdown. Average delivery time and the delay rate both spiked well outside their normal range for the day.',
    entity_type: 'company',
    entity_id: companyId,
    metric: 'avg_delivery_minutes',
    value: 51,
    threshold: 35,
    resolved_at: iso(nowMs - (STORY_RAIN_DAY.daysAgo - 1) * DAY_MS),
    created_at: iso(nowMs - STORY_RAIN_DAY.daysAgo * DAY_MS + 14 * HOUR_MS),
  });

  if (busiest.length > 0) {
    alerts.push({
      id: rng.uuid(),
      company_id: companyId,
      type: 'anomaly',
      severity: 'warning',
      title: 'Uneven workload across drivers',
      message: `${busiest.map((d) => d.full_name).join(' and ')} are carrying substantially more deliveries than the median driver. Sustained imbalance is a burnout and retention risk.`,
      entity_type: 'driver',
      entity_id: busiest[0]!.id,
      metric: 'deliveries_vs_median',
      value: STORY_OVERLOADED_DRIVERS.loadWeight,
      threshold: 1.2,
      resolved_at: null,
      created_at: iso(nowMs - 5 * HOUR_MS),
    });
  }

  return alerts;
}

/**
 * Resolves the two deliberately overloaded drivers from their zone + slot
 * definition. Exported so the verification layer identifies them by exactly
 * the same rule the generator used.
 */
export function resolveOverloadedDrivers(drivers: Driver[], zones: Zone[]): Driver[] {
  const zoneIdByCode = new Map(zones.map((z) => [z.code, z.id]));
  const slotsByZone = new Map<string, Driver[]>();
  for (const driver of drivers) {
    if (!driver.home_zone_id) continue;
    const list = slotsByZone.get(driver.home_zone_id) ?? [];
    list.push(driver);
    slotsByZone.set(driver.home_zone_id, list);
  }

  const out: Driver[] = [];
  for (const target of STORY_OVERLOADED_DRIVERS.drivers) {
    const zoneId = zoneIdByCode.get(target.zoneCode);
    if (!zoneId) continue;
    const driver = slotsByZone.get(zoneId)?.[target.slot];
    if (driver) out.push(driver);
  }
  return out;
}

/** Company-local calendar day index for a timestamp (days since the epoch). */
export function localDayIndex(ms: number): number {
  return Math.floor((ms + COMPANY_UTC_OFFSET_HOURS * HOUR_MS) / DAY_MS);
}

/**
 * Whole company-local calendar days between `ms` and `nowMs`. This is the same
 * notion of "days ago" the generator loops over, so verification and analytics
 * bucket orders into exactly the days that produced them. Counting elapsed
 * milliseconds instead would split every calendar day across two buckets.
 */
export function companyDaysAgo(nowMs: number, ms: number): number {
  return localDayIndex(nowMs) - localDayIndex(ms);
}

/** Day of week (0 = Sunday) of the company-local day `daysAgo` days back. */
export function localDayOfWeek(nowMs: number, daysAgo: number): number {
  const dayStartUtc = (localDayIndex(nowMs) - daysAgo) * DAY_MS - COMPANY_UTC_OFFSET_HOURS * HOUR_MS;
  return new Date(dayStartUtc + COMPANY_UTC_OFFSET_HOURS * HOUR_MS).getUTCDay();
}
