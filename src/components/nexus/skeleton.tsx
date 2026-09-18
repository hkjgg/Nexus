import { cn } from '@/lib/ui/cn';

/**
 * A loading placeholder shaped like the thing it stands in for.
 *
 * The pulse is the one ambient animation in the product, and the global
 * `prefers-reduced-motion` rule collapses it to a static block.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-raised animate-pulse rounded', className)} aria-hidden />;
}

/** The KPI row while its numbers are still in flight. */
export function KpiTileSkeleton() {
  return (
    <div className="border-line bg-surface rounded-lg border p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <div className="mt-3 flex items-end justify-between gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}

/** A card-shaped placeholder: header line plus a body of the given height. */
export function PanelSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('border-line bg-surface rounded-lg border p-4', className)}>
      <Skeleton className="h-3 w-32" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('border-line bg-surface rounded-lg border p-4', className)}>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-48 w-full" />
      <Skeleton className="mt-3 h-24 w-full" />
    </div>
  );
}
