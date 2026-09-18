/**
 * Formatting for KPI values.
 *
 * Currency and locale come from the company record, never from a constant in a
 * component.
 */

import type { KpiFormat } from './types';

export type FormatContext = {
  currency: string;
  locale?: string;
};

export function formatKpi(
  value: number | null,
  format: KpiFormat,
  context: FormatContext,
): string {
  if (value === null || Number.isNaN(value)) return '-';
  const locale = context.locale ?? 'en-US';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: context.currency,
        maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
      }).format(value);

    case 'integer':
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

    case 'percent':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);

    case 'minutes':
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} min`;
  }
}

/** Signed percentage delta, e.g. "+4.2%". */
export function formatDelta(change: number | null, locale = 'en-US'): string {
  if (change === null || Number.isNaN(change)) return '-';
  const formatted = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(change);
  return formatted;
}
