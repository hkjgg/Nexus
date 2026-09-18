/** Console reporting shared by the seed script and the dry run. */

import type { GeneratedDataset } from '@/lib/sim/generate';
import { verifyBaselines, verifyStories, type Check } from '@/lib/sim/verify';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

export function printCounts(data: GeneratedDataset): void {
  const rows: Array<[string, number]> = [
    ['companies', 1],
    ['zones', data.zones.length],
    ['vehicles', data.vehicles.length],
    ['drivers', data.drivers.length],
    ['orders', data.orders.length],
    ['order_events', data.orderEvents.length],
    ['driver_shifts', data.driverShifts.length],
    ['expenses', data.expenses.length],
    ['alerts', data.alerts.length],
  ];

  console.log(`\n${BOLD}Row counts${RESET}`);
  for (const [table, count] of rows) {
    console.log(`  ${table.padEnd(16)} ${count.toLocaleString('en-US').padStart(9)}`);
  }
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  console.log(`  ${DIM}${'total'.padEnd(16)} ${total.toLocaleString('en-US').padStart(9)}${RESET}`);
}

function printChecks(title: string, checks: Check[]): boolean {
  console.log(`\n${BOLD}${title}${RESET}`);
  let allPassed = true;
  for (const check of checks) {
    const mark = check.pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    if (!check.pass) allPassed = false;
    console.log(`  [${mark}] ${check.label}`);
    console.log(`         ${DIM}${check.detail}${RESET}`);
  }
  return allPassed;
}

/** Returns true when every check passed. */
export function printVerification(data: GeneratedDataset): boolean {
  const storiesOk = printChecks('Demo stories', verifyStories(data));
  const baselinesOk = printChecks('Baseline targets', verifyBaselines(data));
  return storiesOk && baselinesOk;
}
