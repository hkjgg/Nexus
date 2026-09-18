/**
 * The alert generator.
 *
 * Collects the signals each rule needs, runs every rule, and returns one
 * ordered list. Nothing is read from the `alerts` table: alerts are a view of
 * the current data, so an alert disappears the moment the condition behind it
 * does.
 *
 * The scan window is deliberately not the range selected in the top bar. An
 * operator filtering the dashboard down to today still needs to know about the
 * van that has been drinking fuel all fortnight, so alerts always look at a
 * fixed recent window and say so on the panel.
 */

import { getKpiSeries } from '@/lib/kpi/series';
import { getZonePerformance } from '@/lib/kpi/zones';
import { startOfDayOffset } from '@/lib/time';
import { getDriverLoadSignals, getVehicleFuelSignals } from './signals';
import { dailySpikeRule, driverOverloadRule, vehicleFuelRule, zoneCapacityRule } from './rules';
import { SEVERITY_RANK, type OperationalAlert } from './types';

/** How far back every rule looks, in whole local days. */
export const ALERT_WINDOW_DAYS = 14;

export type GenerateAlertsParams = {
  companyId: string;
  timeZone: string;
  /** Restricts the result to alerts about one zone, its drivers included. */
  zoneCode?: string | null;
  now?: Date;
};

export async function generateAlerts({
  companyId,
  timeZone,
  zoneCode,
  now = new Date(),
}: GenerateAlertsParams): Promise<OperationalAlert[]> {
  const range = {
    from: startOfDayOffset(now, -(ALERT_WINDOW_DAYS - 1), timeZone),
    to: now,
  };

  const [zones, vehicles, drivers, series] = await Promise.all([
    getZonePerformance(companyId, range),
    getVehicleFuelSignals(companyId, range),
    getDriverLoadSignals(companyId, range),
    getKpiSeries({ companyId, from: range.from, to: range.to, bucket: 'day', timeZone }),
  ]);

  const alerts = [
    ...zoneCapacityRule(zones, now),
    ...vehicleFuelRule(vehicles, now),
    ...driverOverloadRule(drivers, now),
    ...dailySpikeRule(series, timeZone),
  ];

  const scoped = zoneCode ? filterToZone(alerts, zoneCode, zones, drivers) : alerts;

  return scoped.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.detectedAt.getTime() - a.detectedAt.getTime(),
  );
}

/**
 * Narrows the list to one zone.
 *
 * A zone alert is obviously in scope; a driver alert is in scope when the
 * driver is based there. Fleet and whole-day alerts are company-wide and stay
 * visible, because hiding "the whole operation was disrupted on Tuesday"
 * behind a zone filter would be actively misleading.
 */
function filterToZone(
  alerts: readonly OperationalAlert[],
  zoneCode: string,
  zones: readonly { zoneId: string; code: string }[],
  drivers: readonly { driverId: string; zoneCode: string | null }[],
): OperationalAlert[] {
  const zoneId = zones.find((z) => z.code === zoneCode)?.zoneId;
  const driversInZone = new Set(
    drivers.filter((d) => d.zoneCode === zoneCode).map((d) => d.driverId),
  );

  return alerts.filter((alert) => {
    switch (alert.entity.kind) {
      case 'zone':
        return alert.entity.id === zoneId;
      case 'driver':
        return driversInZone.has(alert.entity.id);
      default:
        return true;
    }
  });
}

export * from './types';
export { THRESHOLDS } from './rules';
