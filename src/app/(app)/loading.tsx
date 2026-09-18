import { ChartSkeleton, KpiTileSkeleton, PanelSkeleton } from '@/components/nexus';

/**
 * The shape of the Command Center before its data lands.
 *
 * It mirrors the real layout rather than showing a spinner, so nothing jumps
 * when the numbers arrive.
 */
export default function Loading() {
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <ChartSkeleton className="xl:col-span-7" />
        <PanelSkeleton rows={4} className="xl:col-span-5" />
        <PanelSkeleton rows={8} className="xl:col-span-7" />
        <PanelSkeleton rows={6} className="xl:col-span-5" />
      </div>
    </div>
  );
}
