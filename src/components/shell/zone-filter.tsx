'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { ZONE_PARAM } from '@/lib/filters';
import { useFilterParam } from './use-filter-param';

export type ZoneOption = { code: string; name: string };

/**
 * Scopes the screen to one zone.
 *
 * A native select: nine options is past the point where a segmented control
 * earns its width, and the native control is the one that already works with
 * a keyboard, a screen reader and a phone.
 */
export function ZoneFilter({ zones }: { zones: readonly ZoneOption[] }) {
  const { value, setValue, pending } = useFilterParam(ZONE_PARAM, 'all');

  return (
    <div className={cn('relative', pending && 'opacity-60')}>
      <label htmlFor="zone-filter" className="sr-only">
        Zone
      </label>
      <select
        id="zone-filter"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={cn(
          'border-line bg-inset text-ink-muted appearance-none rounded-md border',
          'py-1.5 pr-8 pl-2.5 text-xs',
          'hover:border-line-strong transition-colors duration-150',
        )}
      >
        <option value="all">All zones</option>
        {zones.map((zone) => (
          <option key={zone.code} value={zone.code}>
            {zone.code} · {zone.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="text-ink-faint pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}
