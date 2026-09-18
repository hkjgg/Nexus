import { ShieldCheck } from 'lucide-react';
import {
  AlertItem,
  Card,
  EmptyState,
  Reveal,
  SectionHeader,
  StatusBadge,
} from '@/components/nexus';
import type { NexusAlert } from '@/lib/alerts';

/**
 * Everything the rules found in the selected range, worst first.
 *
 * Nothing here is stored: the findings are derived on each request from the
 * same rows the KPIs above are, so an alert can never contradict the number
 * beside it or linger after the problem is gone.
 */
export function AlertsPanel({ alerts }: { alerts: readonly NexusAlert[] }) {
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;

  return (
    <Card flush className="flex flex-col">
      <div className="border-line border-b p-4">
        <SectionHeader
          title="Alerts"
          description="Generated from the data by rule, not written by hand"
          actions={
            alerts.length > 0 ? (
              <StatusBadge tone={critical > 0 ? 'critical' : 'warn'}>
                {critical > 0 ? `${critical} critical` : `${alerts.length} open`}
              </StatusBadge>
            ) : null
          }
        />
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing to flag"
          description="No zone, vehicle, driver or day in this range is far enough from its peers to be worth your attention."
        />
      ) : (
        <div className="divide-line max-h-[26rem] divide-y overflow-y-auto">
          {alerts.map((alert, index) => (
            <Reveal key={alert.id} index={index}>
              <AlertItem
                severity={alert.severity}
                title={alert.title}
                message={alert.message}
                subject={alert.subject}
                evidence={alert.evidence}
              />
            </Reveal>
          ))}
        </div>
      )}
    </Card>
  );
}
