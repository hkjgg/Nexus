/**
 * A bare trend line for a KPI tile.
 *
 * Hand-rolled SVG rather than a chart library: it renders on the server, costs
 * nothing, and a sparkline has no axes, no tooltip and no legend to justify
 * one. The chart on the Command Center is a real chart and uses Recharts.
 */

import { cn } from '@/lib/cn';

export type SparklineProps = {
  /** One value per bucket, oldest first. Nulls are gaps. */
  values: readonly (number | null)[];
  /** Colours the stroke; defaults to the neutral text colour. */
  tone?: 'neutral' | 'positive' | 'critical';
  className?: string;
  width?: number;
  height?: number;
};

const TONE_STROKE: Record<NonNullable<SparklineProps['tone']>, string> = {
  neutral: 'stroke-muted',
  positive: 'stroke-positive',
  critical: 'stroke-critical',
};

export function Sparkline({
  values,
  tone = 'neutral',
  className,
  width = 120,
  height = 28,
}: SparklineProps) {
  const points = values.filter((v): v is number => v !== null);
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 2;
  const usable = height - pad * 2;

  const coords: string[] = [];
  values.forEach((value, i) => {
    if (value === null) return;
    const x = i * stepX;
    const y = pad + (1 - (value - min) / span) * usable;
    coords.push(`${coords.length === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  });

  return (
    <svg
      className={cn('overflow-visible', className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <path
        d={coords.join(' ')}
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={TONE_STROKE[tone]}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
