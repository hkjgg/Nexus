import { cn } from '@/lib/ui/cn';

type SparklineProps = {
  /** Oldest point first. Fewer than two points renders nothing. */
  points: readonly number[];
  /** Description for screen readers; the shape alone says nothing to them. */
  label: string;
  /** Any CSS colour. Defaults to the muted ink so it stays behind the value. */
  stroke?: string;
  className?: string;
  width?: number;
  height?: number;
};

/**
 * A bare trend line: no axes, no grid, no hover. It exists to say "rising",
 * "flat" or "falling" at a glance; the number beside it and the chart below
 * carry the detail.
 */
export function Sparkline({
  points,
  label,
  stroke = 'var(--color-ink-faint)',
  className,
  width = 72,
  height = 24,
}: SparklineProps) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1;
  const step = width / (points.length - 1);
  // Inset by the stroke half-width so the line never clips at the edges.
  const inset = 1.5;
  const plotHeight = height - inset * 2;

  const coords = points.map((value, index) => {
    const x = index * step;
    const y = inset + plotHeight - ((value - min) / span) * plotHeight;
    return [x, y] as const;
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  const last = coords[coords.length - 1];

  return (
    <svg
      className={cn('overflow-visible', className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <path
        d={path.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* The latest point is the one that matters, so it gets a marker with a
          surface ring to lift it off the line. */}
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2}
        fill={stroke}
        stroke="var(--color-surface)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
