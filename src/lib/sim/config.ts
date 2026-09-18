/**
 * Every tunable constant of the demo data engine lives here.
 *
 * Two rules keep the demo trustworthy:
 *   1. Nothing in the UI hard-codes a number. The UI reads the database; the
 *      database is produced from these constants.
 *   2. The four demo stories are declared here as data, so the seed summary
 *      can verify them and the analytics/AI layers can be tested against the
 *      same definitions later.
 */

/** Changing this changes every generated row. Keep it stable. */
export const SIM_SEED = 'nexus-swift-parcel-v1';

export const COMPANY = {
  name: 'Swift Parcel Co.',
  currency: 'USD',
  timezone: 'Asia/Beirut',
} as const;

/** Fictional city centre the whole operation is built around. */
export const CITY_CENTER = { lat: 33.89, lng: 35.5 } as const;

export const HISTORY_DAYS = 90;

/** Mean orders per day before weekday, seasonal and story multipliers. */
export const BASE_ORDERS_PER_DAY = 600;

/** Day-to-day demand noise, as a multiplicative standard deviation. */
export const DAILY_NOISE_STDDEV = 0.06;

/**
 * Relative demand by hour of day (index 0..23). Peaks over lunch (12:00-14:00)
 * and dinner (19:00-21:00); the small hours (02:00-08:00) are quiet.
 */
export const HOURLY_DEMAND_CURVE: readonly number[] = [
  0.3, 0.2, 0.1, 0.08, 0.08, 0.1, 0.15, 0.25, 0.55, 0.8, 1.0, 1.35, 2.2, 2.3, 1.7, 1.2, 1.15, 1.35,
  1.7, 2.4, 2.45, 1.9, 1.1, 0.6,
];

/** Multiplier by JS day-of-week (0 = Sunday). Friday is the weekly peak. */
export const WEEKDAY_MULTIPLIER: readonly number[] = [
  0.92, // Sun
  0.96, // Mon
  0.98, // Tue
  1.0, // Wed
  1.02, // Thu
  1.25, // Fri
  1.08, // Sat
];

export const ORDER_CHANNELS = ['app', 'website', 'marketplace', 'pos', 'phone'] as const;
export const ORDER_CHANNEL_WEIGHTS = [0.42, 0.24, 0.16, 0.12, 0.06] as const;

/** Baseline outcome rates under normal conditions. */
export const OUTCOME_RATES = {
  cancelled: 0.04,
  failed: 0.01,
  /** Share of delivered orders that miss their promised time. */
  late: 0.08,
} as const;

export const CANCEL_REASONS = [
  'customer_unreachable',
  'customer_cancelled',
  'address_not_found',
  'payment_failed',
  'duplicate_order',
] as const;

export const FAILURE_REASONS = [
  'recipient_refused',
  'package_damaged',
  'access_denied',
  'repeated_delivery_attempt_failed',
] as const;

/** Service level: an order is promised this many minutes after it is placed. */
export const SLA_MINUTES = 60;

/** Delivery duration model: minutes from picked_up_at to delivered_at. */
export const DURATION = {
  /** Fixed handling time regardless of distance. */
  baseMinutes: 13,
  /** Added minutes per kilometre of the drop leg. */
  minutesPerKm: 4.6,
  /** Multiplicative noise on the on-time path. */
  noiseStdDev: 0.14,
  /** Late orders take this much longer, multiplicatively. */
  lateMultiplierMin: 1.9,
  lateMultiplierMax: 3.0,
} as const;

/** Minutes between the lifecycle transitions that precede pickup. */
export const LEAD_TIMES = {
  assignMinMinutes: 1,
  assignMaxMinutes: 7,
  pickupMinMinutes: 4,
  pickupMaxMinutes: 13,
  /** in_transit is logged shortly after pickup. */
  transitMinMinutes: 1,
  transitMaxMinutes: 4,
} as const;

/**
 * Pricing. Fees are what the customer pays for the delivery.
 *
 * Calibrated against the cost model below so the company runs at a thin but
 * positive margin - around 13-15% - which is what last-mile delivery actually
 * looks like, and leaves the platform something worth finding.
 */
export const PRICING = {
  baseFee: 3.3,
  feePerKm: 0.95,
  /** Rounded to this many decimals so money stays exact. */
  decimals: 2,
} as const;

/** Fleet composition. Counts must add up to VEHICLE_TOTAL. */
export const FLEET = {
  motorbike: 24,
  van: 8,
  truck: 2,
} as const;

export const VEHICLE_TOTAL = FLEET.motorbike + FLEET.van + FLEET.truck;
export const DRIVER_TOTAL = 40;

/** Per-type vehicle characteristics used for costing. */
export const VEHICLE_SPECS = {
  motorbike: {
    fuelType: 'petrol',
    efficiencyKmPerL: [33, 45] as const,
    fixedCostPerDay: [3, 6] as const,
    maintenancePerWeek: [8, 22] as const,
  },
  van: {
    fuelType: 'diesel',
    efficiencyKmPerL: [9, 12] as const,
    fixedCostPerDay: [18, 26] as const,
    maintenancePerWeek: [35, 90] as const,
  },
  truck: {
    fuelType: 'diesel',
    efficiencyKmPerL: [4, 6] as const,
    fixedCostPerDay: [40, 58] as const,
    maintenancePerWeek: [70, 160] as const,
  },
} as const;

export const FUEL_PRICE_PER_LITER = 1.15;

/**
 * Distance actually driven per delivery, relative to the straight drop leg.
 * Accounts for the trip to pickup, road routing and returning to a hub.
 */
export const DEADHEAD_FACTOR = 1.55;

export const DRIVER_COST_PER_HOUR = [3.8, 5.6] as const;

/** Daily company overhead not attributable to a vehicle or a driver. */
export const DAILY_OVERHEAD = [520, 700] as const;

/** Share of drivers rostered on any given day; the rest are off. */
export const ROSTER_RATE = 0.86;

/**
 * Minutes of a shift consumed per delivery handled. Lower than the wall-clock
 * delivery duration because drivers batch drops on the same run. Utilisation
 * is derived from this, so it is the main lever on fleet_utilization.
 */
export const ACTIVE_MINUTES_PER_ORDER = 23;

/** Utilisation is capped below 100% - a driver is never perfectly packed. */
export const MAX_UTILISATION = 0.97;

// ---------------------------------------------------------------------------
// Demo stories
//
// Four deliberate patterns planted in the data. Analytics and, later, the AI
// analyst must be able to discover each one without being told where to look.
// ---------------------------------------------------------------------------

export const STORY_ZONE_SURGE = {
  /** The zone whose demand runs away from its driver capacity. */
  zoneCode: 'Z04',
  /**
   * Drivers permanently assigned to the zone. Deliberately one below what its
   * demand weight would justify: the zone is understaffed before the surge
   * even begins, which is what pushes utilisation past the ceiling once volume
   * climbs. Headcount never changes over the window - that is the story.
   */
  driverCount: 4,
  /** Length of the surge window, counting back from today. */
  windowDays: 14,
  /** Demand at the end of the window relative to its start. */
  growth: 0.38,
  /** Late rate climbs from the baseline to this by the end of the window. */
  peakLateRate: 0.26,
} as const;

export const STORY_THIRSTY_VAN = {
  /** Plate of the van burning more fuel than its peers. */
  plate: 'SP-V03',
  /** Actual litres per km, relative to the van's registered efficiency. */
  excessFuelRate: 0.3,
} as const;

export const STORY_OVERLOADED_DRIVERS = {
  /**
   * Identified by zone and position within that zone rather than by a global
   * roster index, so the story survives any change to how drivers are shared
   * out between zones. Both zones carry close to the median load per driver,
   * which is what makes the comparison against the median meaningful.
   */
  drivers: [
    { zoneCode: 'Z06', slot: 1 },
    { zoneCode: 'Z08', slot: 2 },
  ] as const,
  /**
   * Extra weight these drivers get when orders are handed out in their zone.
   * Dispatch randomness dilutes it a little, so the realised excess over the
   * median driver lands near 40%.
   */
  loadWeight: 1.55,
} as const;

export const STORY_RAIN_DAY = {
  /** Days back from today. 0 would be today. */
  daysAgo: 9,
  /**
   * Baseline slowdown applied to every delivery that day. The bulk of the jump
   * in average delivery time comes from the much higher late rate below; this
   * factor slows down even the deliveries that still make their promise.
   */
  durationMultiplier: 1.19,
  /** Late rate on the rain day. */
  lateRate: 0.42,
  /** Cancellations rise too - people are not at the door. */
  cancelRate: 0.07,
} as const;
