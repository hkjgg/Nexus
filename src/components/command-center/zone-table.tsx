import { MapPinOff } from 'lucide-react';
import {
  Card,
  DataTable,
  EmptyState,
  SectionHeader,
  StatusBadge,
  type Column,
  type StatusTone,
} from '@/components/nexus';
import { median } from '@/lib/alerts';
import type { ZonePerformance } from '@/lib/kpi';

/**
 * How a zone is judged.
 *
 * Service alone is not enough: a zone can be late because it is overloaded or
 * because it is slow, and the two need different answers. So a zone is at
 * risk when its on-time rate has fallen below the service floor, and under
 * pressure when its load per driver has run well ahead of the median zone.
 * Both thresholds are the same ones the capacity alert uses.
 */
const SERVICE_FLOOR = 0.85;
const SERVICE_WATCH = 0.9;
const LOAD_RATIO = 1.25;

type ZoneRow = ZonePerformance & { tone: StatusTone; state: string };

function classify(zones: readonly ZonePerformance[]): ZoneRow[] {
  const loads = zones
    .map((zone) => zone.ordersPerDriverPerDay)
    .filter((value): value is number => value !== null);
  const medianLoad = median(loads) ?? 0;

  return zones.map((zone) => {
    const overloaded =
      medianLoad > 0 &&
      zone.ordersPerDriverPerDay !== null &&
      zone.ordersPerDriverPerDay / medianLoad >= LOAD_RATIO;

    if (zone.onTimeRate !== null && zone.onTimeRate < SERVICE_FLOOR) {
      return { ...zone, tone: 'critical' as const, state: 'At risk' };
    }
    if (overloaded) {
      return { ...zone, tone: 'warn' as const, state: 'Under pressure' };
    }
    if (zone.onTimeRate !== null && zone.onTimeRate < SERVICE_WATCH) {
      return { ...zone, tone: 'warn' as const, state: 'Watch' };
    }
    return { ...zone, tone: 'good' as const, state: 'Healthy' };
  });
}

const percent = (value: number | null): string =>
  value === null ? '-' : `${(value * 100).toFixed(1)}%`;

const COLUMNS: readonly Column<ZoneRow>[] = [
  {
    key: 'zone',
    header: 'Zone',
    render: (zone) => (
      <span className="flex items-baseline gap-2">
        <span className="text-ink font-mono text-xs">{zone.code}</span>
        <span className="truncate">{zone.name}</span>
      </span>
    ),
  },
  {
    key: 'state',
    header: 'State',
    render: (zone) => <StatusBadge tone={zone.tone}>{zone.state}</StatusBadge>,
  },
  {
    key: 'orders',
    header: 'Orders',
    numeric: true,
    // On a phone the state and the service rate are what a dispatcher acts
    // on; the raw count is context, so it steps aside to keep them on screen.
    secondary: true,
    render: (zone) => zone.ordersCount.toLocaleString('en-US'),
  },
  { key: 'onTime', header: 'On time', numeric: true, render: (zone) => percent(zone.onTimeRate) },
  {
    key: 'avg',
    header: 'Avg time',
    numeric: true,
    secondary: true,
    render: (zone) =>
      zone.avgDeliveryMinutes === null ? '-' : `${zone.avgDeliveryMinutes.toFixed(1)}m`,
  },
  {
    key: 'drivers',
    header: 'Drivers',
    numeric: true,
    secondary: true,
    render: (zone) => zone.driverCount.toLocaleString('en-US'),
  },
  {
    key: 'load',
    header: 'Orders / driver / day',
    numeric: true,
    render: (zone) =>
      zone.ordersPerDriverPerDay === null ? '-' : zone.ordersPerDriverPerDay.toFixed(1),
  },
];

export function ZoneTable({ zones }: { zones: readonly ZonePerformance[] }) {
  const rows = classify(zones);

  return (
    <Card flush>
      <div className="border-line border-b p-4">
        <SectionHeader
          title="Zone performance"
          description="Service and load per zone over the selected range"
        />
      </div>

      <DataTable
        caption="On-time rate, volume and driver load per zone"
        columns={COLUMNS}
        rows={rows}
        getRowKey={(zone) => zone.zoneId}
        getRowTone={(zone) => (zone.tone === 'good' ? null : zone.tone)}
        empty={
          <EmptyState
            icon={MapPinOff}
            size="inline"
            title="No zones configured"
            description="Run pnpm seed to create the eight service zones and 90 days of history."
          />
        }
      />
    </Card>
  );
}
