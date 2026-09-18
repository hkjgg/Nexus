/**
 * The alert engine.
 *
 * Gathers the measurements each rule needs, runs every rule, and returns the
 * findings worst-first. Nothing is stored: alerts are derived from the data
 * on every request, so they can never go stale or contradict the KPIs beside
 * them on the page.
 */

import { getDailyOpsFacts, getDriverLoadFacts, getVehicleFuelFacts } from '@/lib/kpi/operations';
import { getZonePerformance } from '@/lib/kpi/series';
import type { DateRange } from '@/lib/kpi/types';
import { dayAnomalyRule, driverLoadRule, vehicleFuelRule, zoneCapacityRule } from './rules';
import { sortAlerts, type NexusAlert } from './types';

export * from './types';
export {
  ALERT_THRESHOLDS,
  dayAnomalyRule,
  driverLoadRule,
  median,
  vehicleFuelRule,
  zoneCapacityRule,
} from './rules';

/**
 * Calling a single day unusual takes a month of ordinary days to compare it
 * with, so the day-anomaly rule always looks back at least this far - even
 * when the operator is looking at a single day.
 */
const MIN_ANOMALY_WINDOW_DAYS = 30;

export type AlertContext = {
  companyId: string;
  range: DateRange;
  /** IANA name; days are cut on the company's clock, not on UTC. */
  timezone: string;
};

export async function generateAlerts(context: AlertContext): Promise<NexusAlert[]> {
  const { companyId, range, timezone } = context;

  const anomalyRange: DateRange = {
    from: new Date(
      Math.min(range.from.getTime(), range.to.getTime() - MIN_ANOMALY_WINDOW_DAYS * 86_400_000),
    ),
    to: range.to,
  };

  const [zones, vehicles, drivers, days] = await Promise.all([
    getZonePerformance({ companyId, from: range.from, to: range.to }),
    getVehicleFuelFacts(companyId, range),
    getDriverLoadFacts(companyId, range),
    getDailyOpsFacts(companyId, anomalyRange, timezone),
  ]);

  return sortAlerts([
    ...zoneCapacityRule(zones),
    ...vehicleFuelRule(vehicles),
    ...driverLoadRule(drivers),
    ...dayAnomalyRule(days),
  ]);
}
