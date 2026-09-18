/**
 * The alert contract.
 *
 * An alert is a finding produced by a rule, not a row someone wrote by hand.
 * Every one carries the measurement that triggered it, so an operator can
 * disagree with the threshold rather than having to trust the alert.
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

/** What kind of problem this is. Drives grouping and, later, routing. */
export type AlertKind = 'zone_capacity' | 'vehicle_fuel' | 'driver_load' | 'day_anomaly';

export type NexusAlert = {
  /**
   * Stable across evaluations of the same range: derived from the rule and
   * the entity, never random, so the UI can key on it and a later milestone
   * can tell a new alert from one that is still open.
   */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  /** A short noun phrase. The severity badge carries the urgency. */
  title: string;
  /** What was measured and what it implies, in one or two sentences. */
  message: string;
  /** The entity it concerns, e.g. "Zone Z04" or "Van SP-V03". */
  subject: string;
  /** The numbers behind the rule, formatted for display. */
  evidence: string;
  /**
   * How far past the threshold the measurement is, as a fraction. Sorts
   * alerts of equal severity so the worst one is always at the top.
   */
  magnitude: number;
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Most severe first, then worst-over-threshold first. */
export function sortAlerts(alerts: readonly NexusAlert[]): NexusAlert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.magnitude - a.magnitude,
  );
}
