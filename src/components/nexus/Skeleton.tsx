/**
 * Loading placeholders.
 *
 * The shapes match what replaces them, so a panel does not jump when its data
 * arrives. The shimmer is a CSS animation, which globals.css already disables
 * under `prefers-reduced-motion`.
 */

import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-raised animate-pulse rounded', className)} aria-hidden />;
}

/** The placeholder for one KpiTile. */
export function SkeletonKpiTile() {
  return (
    <div className="bg-surface rounded-nx border-line-subtle border p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

/** A grid of KPI placeholders, sized to the real grid. */
export function SkeletonKpiGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonKpiTile key={i} />
      ))}
    </div>
  );
}

/** The placeholder for a panel with a header and a body of a known height. */
export function SkeletonPanel({ height = 'h-64', lines }: { height?: string; lines?: number }) {
  return (
    <div className="bg-surface rounded-nx border-line-subtle border p-4">
      <Skeleton className="h-4 w-40" />
      {lines ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <Skeleton className={cn('mt-4 w-full', height)} />
      )}
    </div>
  );
}
