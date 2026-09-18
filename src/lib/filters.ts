/**
 * The two filters that scope every page: a date range and a zone.
 *
 * Both live in the URL rather than in React state, so a view is a link: an
 * operator can send "Riverside, last 30 days" to a colleague and they see the
 * same thing. This module is the only place that knows the query-string names
 * and the only place that turns them into a concrete time window.
 */

import type { DateRange } from '@/lib/kpi/types';
import { startOfDayInZone, startOfDayOffset } from '@/lib/time';

export const RANGE_KEYS = ['today', '7d', '30d', '90d'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = '7d';

/** Query-string parameter names, in one place. */
export const PARAM = { range: 'range', zone: 'zone' } as const;

export type RangeMeta = {
  key: RangeKey;
  /** Shown on the range control. */
  label: string;
  /** Spelled out under a heading. */
  longLabel: string;
  /** Calendar days the window covers, today included. */
  days: number;
  /** Bucket size for the trend chart. */
  bucket: 'hour' | 'day';
  /** What the KPI deltas are measured against. */
  comparisonLabel: string;
};

export const RANGE_META: Record<RangeKey, RangeMeta> = {
  today: {
    key: 'today',
    label: 'Today',
    longLabel: 'Today so far',
    days: 1,
    bucket: 'hour',
    comparisonLabel: 'vs the same hours yesterday',
  },
  '7d': {
    key: '7d',
    label: '7d',
    longLabel: 'Last 7 days',
    days: 7,
    bucket: 'day',
    comparisonLabel: 'vs previous 7 days',
  },
  '30d': {
    key: '30d',
    label: '30d',
    longLabel: 'Last 30 days',
    days: 30,
    bucket: 'day',
    comparisonLabel: 'vs previous 30 days',
  },
  '90d': {
    key: '90d',
    label: '90d',
    longLabel: 'Last 90 days',
    days: 90,
    bucket: 'day',
    comparisonLabel: 'vs previous 90 days',
  },
};

export const RANGE_OPTIONS: readonly RangeMeta[] = RANGE_KEYS.map((key) => RANGE_META[key]);

/** Anything unrecognised falls back to the default rather than throwing. */
export function parseRangeKey(value: string | string[] | undefined): RangeKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return RANGE_KEYS.includes(raw as RangeKey) ? (raw as RangeKey) : DEFAULT_RANGE;
}

/** The zone filter, as it appears in the URL. `all` means no zone filter. */
export const ALL_ZONES = 'all';

export function parseZoneCode(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === ALL_ZONES) return ALL_ZONES;
  // Zone codes are Z01..Z99; anything else is discarded rather than queried.
  return /^Z\d{2}$/.test(raw) ? raw : ALL_ZONES;
}

/**
 * The window a range key stands for, in the company's time zone.
 *
 * Ranges end at `now` and start at a local midnight, so a bucket on the chart
 * is a whole day rather than a rolling 24 hours that straddles two of them.
 * The final bucket is the day in progress.
 */
export function resolveRange(key: RangeKey, timeZone: string, now: Date = new Date()): DateRange {
  const { days } = RANGE_META[key];
  const from =
    days <= 1 ? startOfDayInZone(now, timeZone) : startOfDayOffset(now, -(days - 1), timeZone);
  return { from, to: now };
}

/**
 * The window each range is compared against.
 *
 * Shifted by one whole period in calendar days and cut to the same elapsed
 * length, so a partly finished period is compared with the same part of the
 * period before it: "today so far" against the same hours yesterday, "the last
 * seven days" against the seven before them up to the same time of day.
 * Comparing against the slice that merely ends where this one starts would put
 * a Tuesday morning next to a Monday evening.
 */
export function resolvePreviousRange(
  key: RangeKey,
  timeZone: string,
  now: Date = new Date(),
): DateRange {
  const { days } = RANGE_META[key];
  const current = resolveRange(key, timeZone, now);
  const span = current.to.getTime() - current.from.getTime();

  const from = startOfDayOffset(now, -(2 * days - 1), timeZone);
  return { from, to: new Date(from.getTime() + span) };
}

/** Builds the query string for a filter change, preserving the other filter. */
export function filterHref(
  pathname: string,
  current: { range: RangeKey; zone: string },
  next: Partial<{ range: RangeKey; zone: string }>,
): string {
  const range = next.range ?? current.range;
  const zone = next.zone ?? current.zone;

  const params = new URLSearchParams();
  if (range !== DEFAULT_RANGE) params.set(PARAM.range, range);
  if (zone !== ALL_ZONES) params.set(PARAM.zone, zone);

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
