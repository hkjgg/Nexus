/**
 * How an on-time rate turns into a colour.
 *
 * A diverging scale with a neutral middle: blue where the promise is being
 * kept, grey where it is borderline, red where it is not. The bands are fixed
 * rather than relative to the current period, so a zone does not change
 * colour because the rest of the network had a bad week.
 *
 * This lives outside the map component on purpose. The map is a client
 * component, and a plain constant exported from one reaches the server as a
 * module reference rather than as its value, so the legend - which renders on
 * the server - would find nothing to iterate.
 */

export const SERVICE_BANDS = [
  { min: 0.95, color: '#6da7ec', label: '95% and above' },
  { min: 0.9, color: '#2a78d6', label: '90 - 95%' },
  { min: 0.85, color: '#4a5260', label: '85 - 90%' },
  { min: 0.8, color: '#c0504f', label: '80 - 85%' },
  { min: 0, color: '#e66767', label: 'below 80%' },
] as const;

/** Used where a zone took no promised delivery in the range. */
export const NO_DATA_COLOR = '#2b3340';

export function bandColor(onTimeRate: number | null): string {
  if (onTimeRate === null) return NO_DATA_COLOR;
  return SERVICE_BANDS.find((band) => onTimeRate >= band.min)?.color ?? NO_DATA_COLOR;
}

/** Driver dot colours, keyed by the driver's current shift state. */
export const DRIVER_COLORS = {
  on_shift: '#0ca30c',
  on_break: '#fab219',
  off_shift: '#64707f',
} as const;
