'use client';

/**
 * Orders and on-time rate over the selected range.
 *
 * Two panels stacked on a shared x-axis rather than one chart with two y-axes:
 * a count and a percentage have no common scale, and overlaying them on
 * separate axes lets the author decide where the lines cross. Stacked panels
 * answer the same question - "did service hold up as volume moved?" - by
 * letting the reader line the two up vertically, without inventing a
 * relationship between the scales.
 *
 * Colours come from the validated chart slots in globals.css; each panel shows
 * one series, so the panel heading is the legend.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/nexus';

export type TrendPoint = {
  /** Axis label, pre-formatted in the company's time zone. */
  label: string;
  /** Long form for the tooltip heading. */
  fullLabel: string;
  orders: number;
  /** Percentage points, 0-100. Null where nothing carried a promise. */
  onTimePercent: number | null;
};

export type TrendChartProps = {
  data: readonly TrendPoint[];
};

const AXIS_TICK = { fill: 'var(--nx-text-faint)', fontSize: 11 };
const AXIS_LINE = { stroke: 'var(--nx-border-subtle)' };

type TooltipPayload = { payload: TrendPoint }[];

function ChartTooltip({
  active,
  payload,
  unit,
  metricLabel,
  value,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  unit: string;
  metricLabel: string;
  value: (point: TrendPoint) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="bg-raised border-line rounded-nx-sm shadow-nx border px-3 py-2">
      <p className="text-secondary text-xs font-medium">{point.fullLabel}</p>
      <p className="nx-numeric text-content mt-1 text-sm">
        {value(point)}
        <span className="text-faint ml-1 text-xs">{unit}</span>
      </p>
      <p className="text-faint text-[0.6875rem]">{metricLabel}</p>
    </div>
  );
}

export function TrendChart({ data }: TrendChartProps) {
  if (data.length < 2) {
    return (
      <EmptyState
        title="Not enough history to plot"
        description="Pick a longer range, or seed more days of data."
      />
    );
  }

  const points = [...data];
  // Recharts needs a plain mutable array; the props arrive readonly.

  return (
    <div className="space-y-1">
      <section aria-label="Orders per bucket">
        <p className="text-muted mb-1 flex items-center gap-2 text-xs">
          <span
            className="size-2 rounded-[2px]"
            style={{ background: 'var(--nx-chart-1)' }}
            aria-hidden
          />
          Orders
        </p>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--nx-chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={false}
                axisLine={AXIS_LINE}
                tickLine={false}
                height={1}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={46}
                allowDecimals={false}
                tickFormatter={(value: number) => value.toLocaleString('en-US')}
              />
              <Tooltip
                cursor={{ fill: 'var(--nx-border-subtle)' }}
                content={
                  <ChartTooltip
                    unit="orders"
                    metricLabel="Orders placed"
                    value={(point) => point.orders.toLocaleString('en-US')}
                  />
                }
              />
              <Bar
                dataKey="orders"
                fill="var(--nx-chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="On-time rate per bucket">
        <p className="text-muted mb-1 flex items-center gap-2 text-xs">
          <span
            className="size-2 rounded-full"
            style={{ background: 'var(--nx-chart-2)' }}
            aria-hidden
          />
          On-time rate
        </p>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--nx-chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={46}
                // A rate chart that always plots 0-100 flattens the band an
                // operator actually watches. The floor is pulled down to the
                // worst bucket instead, rounded to a multiple of five and
                // never above 80, so the axis still reads as a percentage.
                domain={[
                  (dataMin: number) => Math.max(0, Math.min(80, Math.floor((dataMin - 4) / 5) * 5)),
                  100,
                ]}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                cursor={{ stroke: 'var(--nx-border-strong)' }}
                content={
                  <ChartTooltip
                    unit="on time"
                    metricLabel="Delivered within the promised window"
                    value={(point) =>
                      point.onTimePercent === null ? '-' : `${point.onTimePercent.toFixed(1)}%`
                    }
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="onTimePercent"
                stroke="var(--nx-chart-2)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--nx-surface)' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
