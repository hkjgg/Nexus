/**
 * The two filters that every screen reads: a date range and a zone.
 *
 * Both live in the URL rather than in React state, so a view is shareable, a
 * reload keeps it, and the server components can do the querying instead of
 * shipping the whole dataset to the browser to be filtered there.
 */

import type { DateRange } from '@/lib/kpi/types';

export const RANGE_PARAM = 'range';
export const ZONE_PARAM = 'zone';

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today', comparison: 'vs yesterday' },
  { value: '7d', label: '7 days', comparison: 'vs previous 7 days' },
  { value: '30d', label: '30 days', comparison: 'vs previous 30 days' },
  { value: '90d', label: '90 days', comparison: 'vs previous 90 days' },
] as const;

export type RangeKey = (typeof RANGE_OPTIONS)[number]['value'];

export const DEFAULT_RANGE: RangeKey = '7d';

const TRAILING_DAYS: Record<Exclude<RangeKey, 'today'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** Anything unrecognised falls back to the default rather than erroring. */
export function parseRange(value: string | string[] | undefined): RangeKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return RANGE_OPTIONS.some((option) => option.value === candidate)
    ? (candidate as RangeKey)
    : DEFAULT_RANGE;
}

export function rangeLabel(key: RangeKey): string {
  return RANGE_OPTIONS.find((option) => option.value === key)?.label ?? key;
}

export function comparisonLabel(key: RangeKey): string {
  return RANGE_OPTIONS.find((option) => option.value === key)?.comparison ?? 'vs previous period';
}

/**
 * Midnight of the current day on the given clock, as an instant.
 *
 * Computed by subtracting the elapsed wall-clock time from now, which needs
 * no date library. A day that contains a daylight-saving transition lands an
 * hour out; the alternative is a dependency, and an hour does not change what
 * the operator is looking at.
 */
function startOfDayInZone(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  // Some ICU builds render midnight as hour 24.
  const elapsedMs =
    (value('hour') % 24) * 3_600_000 +
    value('minute') * 60_000 +
    value('second') * 1_000 +
    now.getMilliseconds();

  return new Date(now.getTime() - elapsedMs);
}

/**
 * `today` runs from local midnight to now, so it means the day the operator
 * is having. The trailing ranges end now rather than at midnight, so a
 * seven-day view always covers seven full days of trading.
 */
export function resolveRange(key: RangeKey, timezone: string, now: Date = new Date()): DateRange {
  if (key === 'today') {
    return { from: startOfDayInZone(now, timezone), to: now };
  }
  return { from: new Date(now.getTime() - TRAILING_DAYS[key] * 86_400_000), to: now };
}

/** Zone codes are opaque strings here; the caller resolves them against the DB. */
export function parseZone(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === 'all') return null;
  return candidate;
}

/** Search params as Next.js hands them to a page. */
export type SearchParams = Record<string, string | string[] | undefined>;
