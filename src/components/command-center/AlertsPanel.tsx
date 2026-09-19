/**
 * The alerts panel.
 *
 * Alerts are derived from the current data by the rules in src/lib/alerts, so
 * this component only has to render them and say what window they cover. An
 * empty panel is a good outcome, and says so rather than looking broken.
 */

import { ShieldCheck } from 'lucide-react';
import { AlertItem, EmptyState } from '@/components/nexus';
import type { OperationalAlert } from '@/lib/alerts/types';

export type AlertsPanelProps = {
  alerts: readonly OperationalAlert[];
  timeZone: string;
};

export function AlertsPanel({ alerts, timeZone }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing needs attention"
        description="No zone, vehicle, driver or day crossed a threshold in the scan window."
      />
    );
  }

  const formatDay = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="divide-line-subtle divide-y">
      {alerts.map((alert) => (
        <AlertItem
          key={alert.id}
          severity={alert.severity}
          title={alert.title}
          message={alert.message}
          entityLabel={alert.entity.label}
          readout={`${alert.valueLabel} vs ${alert.thresholdLabel} threshold`}
          timeLabel={formatDay.format(alert.detectedAt)}
        />
      ))}
    </div>
  );
}
