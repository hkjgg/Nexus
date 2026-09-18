'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { Card, DataTable, SectionHeader, type Column } from '@/components/nexus';

export type ChartPoint = {
  /** Stable key and x-axis category. */
  key: string;
  /** Short axis label, e.g. "14 Sep" or "19:00". */
  label: string;
  /** Full label for the tooltip and the table. */
  fullLabel: string;
  orders: number;
  /** Null when nothing in the bucket carried a promised time. */
  onTimeRate: number | null;
};

type PerformanceChartProps = {
  points: readonly ChartPoint[];
  /** The whole period's on-time rate, drawn as a reference on the lower panel. */
  averageOnTimeRate: number | null;
  /** Wording for the axis description. */
  bucketLabel: string;
};

const AXIS_TICK = { fill: 'var(--color-ink-faint)', fontSize: 10 };

/**
 * Orders and on-time rate across the selected range.
 *
 * Deliberately two panels rather than one chart with two y-axes. Orders are a
 * count and on-time is a rate: putting them on one plot means choosing an
 * arbitrary alignment between the two scales, which invents a correlation the
 * data does not contain. Stacked panels share one x-axis and one hover, so
 * the comparison is still made at a glance and the reading stays honest.
 *
 * A table view sits behind a toggle so no value is reachable only by hover.
 */
export function PerformanceChart({
  points,
  averageOnTimeRate,
  bucketLabel,
}: PerformanceChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const hasOnTime = points.some((point) => point.onTimeRate !== null);
  const onTimeValues = points
    .map((point) => point.onTimeRate)
    .filter((value): value is number => value !== null);

  // A rate that lives between 0.85 and 0.95 is invisible on a 0-100% axis, so
  // the lower panel zooms to the band the data actually occupies, rounded out
  // to a clean 5% step and always ending at 100%.
  const floor =
    onTimeValues.length > 0 ? Math.max(0, Math.floor(Math.min(...onTimeValues) * 20 - 1) / 20) : 0;

  return (
    <Card flush className="flex flex-col">
      <div className="border-line border-b p-4">
        <SectionHeader
          title="Volume and service"
          description={`Orders placed and on-time rate per ${bucketLabel}`}
          actions={
            <div className="border-line bg-inset inline-flex rounded-md border p-0.5">
              <ViewToggle
                active={view === 'chart'}
                onClick={() => setView('chart')}
                icon={BarChart3}
                label="Chart"
              />
              <ViewToggle
                active={view === 'table'}
                onClick={() => setView('table')}
                icon={Table2}
                label="Table"
              />
            </div>
          }
        />
      </div>

      {view === 'table' ? (
        <div className="max-h-[26rem] overflow-y-auto">
          <DataTable
            caption="Orders and on-time rate per bucket"
            columns={TABLE_COLUMNS}
            rows={[...points].reverse()}
            getRowKey={(point) => point.key}
          />
        </div>
      ) : (
        <div className="p-2 pt-3">
          <p className="text-ink-faint px-2 pb-1 text-[0.68rem] tracking-wide uppercase">Orders</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={points as ChartPoint[]}
              syncId="command-center"
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis
                width={44}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-raised)' }}
                content={<ChartTooltip />}
                isAnimationActive={false}
              />
              <Bar
                dataKey="orders"
                name="Orders"
                fill="var(--color-series-1)"
                radius={[2, 2, 0, 0]}
                maxBarSize={22}
                // Without this the bars grow from zero again on every resize,
                // which is motion that tells the reader nothing.
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-ink-faint mt-3 px-2 pb-1 text-[0.68rem] tracking-wide uppercase">
            On-time rate
          </p>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart
              data={points as ChartPoint[]}
              syncId="command-center"
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-line-strong)' }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                width={44}
                domain={[floor, 1]}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-line-strong)' }}
                content={<ChartTooltip />}
                isAnimationActive={false}
              />
              {averageOnTimeRate !== null ? (
                <ReferenceLine
                  y={averageOnTimeRate}
                  stroke="var(--color-ink-faint)"
                  strokeWidth={1}
                  label={{
                    value: `period ${Math.round(averageOnTimeRate * 100)}%`,
                    position: 'insideTopRight',
                    fill: 'var(--color-ink-faint)',
                    fontSize: 10,
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="onTimeRate"
                name="On-time rate"
                stroke="var(--color-series-2)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: 'var(--color-series-2)',
                  stroke: 'var(--color-surface)',
                  strokeWidth: 2,
                }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>

          {!hasOnTime ? (
            <p className="text-ink-faint px-2 pb-2 text-xs">
              No delivery carried a promised time in this range, so there is no on-time rate to
              plot.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BarChart3;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded px-2 py-1 text-[0.68rem] transition-colors duration-150',
        active ? 'bg-raised text-ink' : 'text-ink-faint hover:text-ink-muted',
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </button>
  );
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;

  return (
    <div className="border-line-strong bg-surface rounded-md border px-2.5 py-2 shadow-lg">
      <p className="text-ink-muted mb-1 text-[0.68rem]">{point.fullLabel}</p>
      <p className="text-ink font-mono text-xs tabular-nums">
        {point.orders.toLocaleString('en-US')} orders
      </p>
      <p className="text-ink font-mono text-xs tabular-nums">
        {point.onTimeRate === null ? '-' : `${(point.onTimeRate * 100).toFixed(1)}%`} on time
      </p>
    </div>
  );
}

const TABLE_COLUMNS: readonly Column<ChartPoint>[] = [
  { key: 'bucket', header: 'Period', render: (point) => point.fullLabel },
  {
    key: 'orders',
    header: 'Orders',
    numeric: true,
    render: (point) => point.orders.toLocaleString('en-US'),
  },
  {
    key: 'onTime',
    header: 'On time',
    numeric: true,
    render: (point) =>
      point.onTimeRate === null ? '-' : `${(point.onTimeRate * 100).toFixed(1)}%`,
  },
];
