'use client';

import { cn } from '@/lib/ui/cn';
import { DEFAULT_RANGE, RANGE_OPTIONS, RANGE_PARAM } from '@/lib/filters';
import { useFilterParam } from './use-filter-param';

/**
 * Four ranges, always visible.
 *
 * A segmented control rather than a dropdown: there are only four, they are
 * the most-used control on the page, and seeing which one is active is worth
 * more than the width a dropdown would save.
 */
export function RangeFilter() {
  const { value, setValue, pending } = useFilterParam(RANGE_PARAM, DEFAULT_RANGE);

  return (
    <div
      role="group"
      aria-label="Date range"
      data-pending={pending ? '' : undefined}
      className={cn(
        'border-line bg-inset inline-flex items-center rounded-md border p-0.5',
        pending && 'opacity-60',
      )}
    >
      {RANGE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setValue(option.value)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap',
              'transition-colors duration-150',
              active ? 'bg-raised text-ink' : 'text-ink-faint hover:text-ink-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
