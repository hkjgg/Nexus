/**
 * The alert contract.
 *
 * Alerts are derived, never stored: every one below is recomputed from the
 * current contents of the database by the rules in `./rules`. Nothing here is
 * written by hand and nothing is read from the `alerts` table, so an alert can
 * never describe a situation that has already resolved itself.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';

/** The rules that can fire. One id per rule, stable across runs. */
export type AlertRuleId =
  'zone-capacity-strain' | 'vehicle-fuel-anomaly' | 'driver-overload' | 'daily-delay-spike';

export type AlertEntity = {
  kind: 'zone' | 'vehicle' | 'driver' | 'day';
  /** Database id where one exists; a date for the `day` kind. */
  id: string;
  label: string;
};

export type OperationalAlert = {
  /** Deterministic: same data in, same id out, so React keys stay stable. */
  id: string;
  rule: AlertRuleId;
  severity: AlertSeverity;
  title: string;
  /** One or two sentences: what is happening, and what it is costing. */
  message: string;
  entity: AlertEntity;
  /** The metric that tripped the rule, its value and the threshold it crossed. */
  metric: string;
  value: number;
  threshold: number;
  /** Formatted value and threshold, ready to display. */
  valueLabel: string;
  thresholdLabel: string;
  /** When the condition was observed. */
  detectedAt: Date;
};

/** Severity order for sorting: critical first. */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};
