import { Suspense } from 'react';
import { LiveClock } from './live-clock';
import { RangeFilter } from './range-filter';
import { ZoneFilter, type ZoneOption } from './zone-filter';

type TopBarProps = {
  companyName: string;
  timezone: string;
  zones: readonly ZoneOption[];
};

/**
 * Who we are looking at, over what period, and where.
 *
 * The filters sit here rather than on each panel because they scope the whole
 * screen: one range and one zone, applied to everything below, so two numbers
 * on the page can never be answering different questions.
 */
export function TopBar({ companyName, timezone, zones }: TopBarProps) {
  return (
    <header className="border-line bg-surface/95 sticky top-0 z-20 border-b backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 pl-14 lg:pl-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-ink truncate text-sm font-semibold">{companyName}</h1>
          <p className="text-ink-faint text-[0.68rem]">Operations control tower</p>
        </div>

        {/* The filter controls read the URL, which is a client-side hook, so
            they render behind a boundary rather than blocking the shell. */}
        <Suspense fallback={<div className="h-7 w-64" />}>
          <div className="flex flex-wrap items-center gap-2">
            <RangeFilter />
            <ZoneFilter zones={zones} />
          </div>
        </Suspense>

        <div className="border-line ml-auto border-l pl-4">
          <LiveClock timezone={timezone} />
        </div>
      </div>
    </header>
  );
}
