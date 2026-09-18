'use client';

/**
 * The date-range and zone controls in the top bar.
 *
 * Both write to the URL rather than to component state, so every panel on the
 * page re-renders on the server with the new filter and a filtered view stays
 * shareable. The range control is a segmented row because there are only four
 * options and an operator switches between them constantly; the zone control
 * is a select because there are nine.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ALL_ZONES, PARAM, RANGE_OPTIONS, filterHref, type RangeKey } from '@/lib/filters';
import { cn } from '@/lib/cn';

export type ZoneOption = { code: string; name: string };

export type FilterControlsProps = {
  range: RangeKey;
  zone: string;
  zones: readonly ZoneOption[];
};

export function FilterControls({ range, zone, zones }: FilterControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Read from the URL where possible so the control tracks back/forward
  // navigation, and fall back to the server-resolved value on first paint.
  const activeRange = (searchParams.get(PARAM.range) as RangeKey | null) ?? range;
  const activeZone = searchParams.get(PARAM.zone) ?? zone;

  const go = (next: Partial<{ range: RangeKey; zone: string }>) => {
    const href = filterHref(pathname, { range: activeRange, zone: activeZone }, next);
    startTransition(() => router.push(href, { scroll: false }));
  };

  return (
    <div className={cn('flex items-center gap-2', pending && 'opacity-70')}>
      <div
        role="group"
        aria-label="Date range"
        className="bg-sunken border-line-subtle flex items-center gap-0.5 rounded-full border p-0.5"
      >
        {RANGE_OPTIONS.map((option) => {
          const selected = option.key === activeRange;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              title={option.longLabel}
              onClick={() => go({ range: option.key })}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'bg-raised text-content'
                  : 'text-muted hover:text-secondary hover:bg-raised/60',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="zone-filter">
        Zone
      </label>
      <select
        id="zone-filter"
        value={activeZone}
        onChange={(event) => go({ zone: event.target.value })}
        className="bg-sunken border-line-subtle text-secondary hover:text-content focus:border-accent cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors"
      >
        <option value={ALL_ZONES}>All zones</option>
        {zones.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code} &middot; {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
