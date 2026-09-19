/**
 * How a zone is doing, in four words.
 *
 * The zone table and the mini-map must agree about which zone is in trouble,
 * so the banding lives here and both read it. The bands are on the on-time
 * rate because that is the number the promise to the customer is made against;
 * volume and revenue say how big a zone is, not how well it is running.
 */

export type ZoneHealth = 'on-target' | 'watch' | 'at-risk' | 'critical' | 'unknown';

/**
 * Ordered worst-first, which is also the order the zone table sorts in.
 *
 * `token` is the name of the CSS custom property that carries the colour, not
 * the colour itself. The DOM can use it as `var(--nx-critical)`; the map
 * cannot - WebGL paint properties are parsed by MapLibre and know nothing
 * about the cascade - so it resolves the same token through `getComputedStyle`
 * instead. Either way globals.css stays the only place a colour is defined.
 */
export const ZONE_HEALTH_META: Record<
  ZoneHealth,
  { label: string; tone: 'positive' | 'neutral' | 'caution' | 'critical'; token: string }
> = {
  critical: { label: 'Critical', tone: 'critical', token: '--nx-critical' },
  'at-risk': { label: 'At risk', tone: 'caution', token: '--nx-caution' },
  watch: { label: 'Watch', tone: 'neutral', token: '--nx-info' },
  'on-target': { label: 'On target', tone: 'positive', token: '--nx-positive' },
  unknown: { label: 'No data', tone: 'neutral', token: '--nx-text-faint' },
};

/** Lower bound of each band, in on-time rate. */
export const ZONE_HEALTH_BANDS = {
  onTarget: 0.93,
  watch: 0.88,
  atRisk: 0.83,
} as const;

export function zoneHealth(onTimeRate: number | null): ZoneHealth {
  if (onTimeRate === null) return 'unknown';
  if (onTimeRate >= ZONE_HEALTH_BANDS.onTarget) return 'on-target';
  if (onTimeRate >= ZONE_HEALTH_BANDS.watch) return 'watch';
  if (onTimeRate >= ZONE_HEALTH_BANDS.atRisk) return 'at-risk';
  return 'critical';
}

/** Legend entries for the map, best band first. */
export const ZONE_HEALTH_LEGEND: readonly { health: ZoneHealth; label: string }[] = [
  { health: 'on-target', label: `${Math.round(ZONE_HEALTH_BANDS.onTarget * 100)}%+` },
  { health: 'watch', label: `${Math.round(ZONE_HEALTH_BANDS.watch * 100)}-92%` },
  { health: 'at-risk', label: `${Math.round(ZONE_HEALTH_BANDS.atRisk * 100)}-87%` },
  { health: 'critical', label: `under ${Math.round(ZONE_HEALTH_BANDS.atRisk * 100)}%` },
];
