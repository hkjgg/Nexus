/**
 * Zone performance for the selected range.
 *
 * Sorted by on-time rate, worst first: the point of the panel is to put the
 * zone that needs attention at the top without the operator sorting anything.
 */

import { DataTable, StatusBadge, type Column } from '@/components/nexus';
import { formatKpi } from '@/lib/kpi';
import type { ZonePerformance } from '@/lib/kpi/zones';
import { ZONE_HEALTH_META, zoneHealth } from '@/lib/zone-health';

export type ZoneTableProps = {
  zones: readonly ZonePerformance[];
  currency: string;
};

export function ZoneTable({ zones, currency }: ZoneTableProps) {
  // Zones with no traffic sort last; among the rest, worst on-time first.
  const rows = [...zones].sort((a, b) => {
    if (a.onTimeRate === null) return 1;
    if (b.onTimeRate === null) return -1;
    return a.onTimeRate - b.onTimeRate;
  });

  const columns: readonly Column<ZonePerformance>[] = [
    {
      key: 'zone',
      header: 'Zone',
      cell: (zone) => (
        <div className="flex items-center gap-2">
          <span className="nx-numeric text-faint">{zone.code}</span>
          <span className="text-content truncate">{zone.name}</span>
        </div>
      ),
    },
    {
      key: 'health',
      header: 'Status',
      cell: (zone) => {
        const meta = ZONE_HEALTH_META[zoneHealth(zone.onTimeRate)];
        return (
          <StatusBadge tone={meta.tone} dot>
            {meta.label}
          </StatusBadge>
        );
      },
    },
    {
      key: 'onTime',
      header: 'On time',
      numeric: true,
      align: 'right',
      cell: (zone) => formatKpi(zone.onTimeRate, 'percent', { currency }),
    },
    {
      key: 'orders',
      header: 'Orders',
      numeric: true,
      align: 'right',
      cell: (zone) => formatKpi(zone.ordersCount, 'integer', { currency }),
    },
    {
      key: 'avgTime',
      header: 'Avg time',
      numeric: true,
      align: 'right',
      hideOnMobile: true,
      cell: (zone) => formatKpi(zone.avgDeliveryMinutes, 'minutes', { currency }),
    },
    {
      key: 'drivers',
      header: 'Drivers',
      numeric: true,
      align: 'right',
      hideOnMobile: true,
      cell: (zone) => zone.driverCount,
    },
    {
      key: 'load',
      header: 'Per driver',
      numeric: true,
      align: 'right',
      hideOnMobile: true,
      cell: (zone) => (zone.ordersPerDriver === null ? '-' : zone.ordersPerDriver.toFixed(0)),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      align: 'right',
      cell: (zone) => formatKpi(zone.revenue, 'currency', { currency }),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(zone) => zone.zoneId}
      rowTone={(zone) => {
        const health = zoneHealth(zone.onTimeRate);
        if (health === 'critical') return 'critical';
        if (health === 'at-risk') return 'caution';
        return 'default';
      }}
      caption="Delivery performance by zone over the selected range"
      emptyTitle="No zones configured"
      emptyDescription="Run pnpm seed to generate the demo operation."
    />
  );
}
