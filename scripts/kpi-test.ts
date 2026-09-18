/**
 * Prints all ten KPIs for the last 7 days against the 7 days before that.
 *
 *   pnpm kpi:test              company-wide
 *   pnpm kpi:test --by-zone    plus a per-zone breakdown
 *
 * Nothing here computes a metric itself: every number comes from the same
 * kpi_summary SQL function the dashboard reads, so the script doubles as a
 * check that the layer is wired up correctly.
 */

import './env';

import { closePool, query } from '@/lib/db/pg';
import { hasDatabaseUrl } from '@/lib/db/env';
import {
  KPI_KEYS,
  KPI_META,
  formatDelta,
  formatKpi,
  getKpiComparison,
  lastNDays,
  percentChange,
  precedingWindow,
  type KpiSummary,
} from '@/lib/kpi';

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const byZone = process.argv.includes('--by-zone');

function printTable(current: KpiSummary, previous: KpiSummary, currency: string): void {
  const nameWidth = 24;
  const colWidth = 16;

  console.log(
    `  ${'KPI'.padEnd(nameWidth)}${'Last 7 days'.padStart(colWidth)}${'Prior 7 days'.padStart(colWidth)}${'Change'.padStart(12)}`,
  );
  console.log(`  ${DIM}${'-'.repeat(nameWidth + colWidth * 2 + 12)}${RESET}`);

  for (const key of KPI_KEYS) {
    const meta = KPI_META[key];
    const currentValue = current[key];
    const previousValue = previous[key];
    const change = percentChange(currentValue, previousValue);

    // "Better" depends on the metric: a falling delay rate is good news.
    let delta = formatDelta(change);
    if (change !== null && change !== 0) {
      const improved = meta.higherIsBetter ? change > 0 : change < 0;
      delta = `${improved ? GREEN : RED}${delta}${RESET}`;
      // Colour codes do not occupy visible columns, so pad before colouring.
      const visible = formatDelta(change);
      delta = `${' '.repeat(Math.max(0, 12 - visible.length))}${delta}`;
    } else {
      delta = delta.padStart(12);
    }

    console.log(
      `  ${meta.label.padEnd(nameWidth)}` +
        `${formatKpi(currentValue, meta.format, { currency }).padStart(colWidth)}` +
        `${formatKpi(previousValue, meta.format, { currency }).padStart(colWidth)}` +
        delta,
    );
  }
}

async function main(): Promise<void> {
  if (!hasDatabaseUrl()) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
    process.exitCode = 1;
    return;
  }

  const companies = await query<{ id: string; name: string; currency: string }>(
    'select id, name, currency from companies where is_demo order by created_at limit 1',
  );
  const company = companies[0];

  if (!company) {
    console.error('No demo company found. Run `pnpm db:migrate` then `pnpm seed`.');
    process.exitCode = 1;
    return;
  }

  const range = lastNDays(7);
  const prior = precedingWindow(range);

  console.log(`\n${BOLD}${company.name}${RESET}`);
  console.log(
    `${DIM}Last 7 days   ${range.from.toISOString()} -> ${range.to.toISOString()}\n` +
      `Prior 7 days  ${prior.from.toISOString()} -> ${prior.to.toISOString()}${RESET}\n`,
  );

  const { current, previous } = await getKpiComparison({
    companyId: company.id,
    from: range.from,
    to: range.to,
  });
  printTable(current, previous, company.currency);

  if (byZone) {
    const zones = await query<{ id: string; code: string; name: string }>(
      'select id, code, name from zones where company_id = $1 order by code',
      [company.id],
    );

    for (const zone of zones) {
      const zoned = await getKpiComparison({
        companyId: company.id,
        from: range.from,
        to: range.to,
        zoneId: zone.id,
      });
      console.log(`\n${BOLD}${zone.code} - ${zone.name}${RESET}`);
      printTable(zoned.current, zoned.previous, company.currency);
    }
  }

  console.log('');
}

main()
  .catch((error: unknown) => {
    console.error('\nKPI test failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (hasDatabaseUrl()) await closePool();
  });
