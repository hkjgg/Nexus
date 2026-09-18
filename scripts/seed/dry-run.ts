/**
 * Generates the demo dataset in memory and reports on it without touching a
 * database. Useful for tuning the simulation and for CI, where no Postgres is
 * available.
 *
 *   pnpm tsx scripts/seed/dry-run.ts
 */

import { generateDataset } from '@/lib/sim/generate';
import { printCounts, printVerification } from './summary';

const startedAt = Date.now();
const data = generateDataset();
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

console.log(
  `Generated ${data.orders.length.toLocaleString('en-US')} orders in ${elapsed}s (dry run, nothing written).`,
);
printCounts(data);
const ok = printVerification(data);

process.exit(ok ? 0 : 1);
