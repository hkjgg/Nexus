'use client';

/**
 * The bar across the top of every page.
 *
 * It carries who is being looked at (the company), what slice of them (the
 * range and zone filters), and when (the operation's own clock). Nothing else:
 * anything page-specific belongs in the page's own header.
 */

import { Menu } from 'lucide-react';
import { FilterControls, type ZoneOption } from './FilterControls';
import { LiveClock } from './LiveClock';
import type { RangeKey } from '@/lib/filters';

export type TopBarProps = {
  companyName: string;
  timeZone: string;
  range: RangeKey;
  zone: string;
  zones: readonly ZoneOption[];
  onOpenMobileNav: () => void;
};

export function TopBar({
  companyName,
  timeZone,
  range,
  zone,
  zones,
  onOpenMobileNav,
}: TopBarProps) {
  // "Asia/Beirut" reads better as "Beirut" next to a clock.
  const cityLabel = timeZone.split('/').pop()?.replace(/_/g, ' ');

  return (
    <header className="bg-base/85 border-line-subtle sticky top-0 z-30 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 backdrop-blur sm:h-14 sm:flex-nowrap sm:px-4 sm:py-0">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="text-muted hover:text-content md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-content truncate text-sm font-medium">{companyName}</p>
      </div>

      <div className="hidden lg:block">
        <LiveClock timeZone={timeZone} label={cityLabel} />
      </div>

      {/* On a phone the filters take a line of their own rather than
          squeezing the company name down to nothing. */}
      <div className="order-last w-full overflow-x-auto sm:order-none sm:w-auto">
        <FilterControls range={range} zone={zone} zones={zones} />
      </div>
    </header>
  );
}
