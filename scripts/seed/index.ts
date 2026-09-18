/**
 * Seeds the NEXUS demo database.
 *
 *   pnpm seed          generate and insert (refuses if data already exists)
 *   pnpm seed:reset    truncate every table first, then reseed
 *
 * The whole insert runs in one transaction: either the database ends up with a
 * complete, self-consistent history or it is left exactly as it was.
 */

import '../env';

import type { PoolClient } from 'pg';
import { closePool, query, withTransaction } from '@/lib/db/pg';
import { hasDatabaseUrl } from '@/lib/db/env';
import { generateDataset, type GeneratedDataset } from '@/lib/sim/generate';
import { DEFAULT_CHUNK_SIZE, insertRows } from './insert';
import { printCounts, printVerification } from './summary';

/** Child-to-parent order, so foreign keys never block the truncate. */
const ALL_TABLES = [
  'alerts',
  'expenses',
  'driver_shifts',
  'order_events',
  'orders',
  'drivers',
  'vehicles',
  'zones',
  'companies',
] as const;

const shouldReset = process.argv.includes('--reset');

async function truncateAll(client: PoolClient): Promise<void> {
  await client.query(`truncate table ${ALL_TABLES.join(', ')} restart identity cascade`);
}

async function insertAll(client: PoolClient, data: GeneratedDataset): Promise<void> {
  // Carriage-return progress only makes sense on a terminal; when the output
  // is piped or captured in CI it would produce one line per chunk.
  const isTty = process.stdout.isTTY === true;

  const progress = (table: string) => (inserted: number, total: number) => {
    if (total <= DEFAULT_CHUNK_SIZE) return;
    if (!isTty) {
      if (inserted === total) console.log(`  ${table.padEnd(14)} ${total.toLocaleString('en-US')} rows`);
      return;
    }
    const percent = Math.round((inserted / total) * 100);
    process.stdout.write(
      `\r  ${table.padEnd(14)} ${String(percent).padStart(3)}%  (${inserted.toLocaleString('en-US')}/${total.toLocaleString('en-US')})`,
    );
    if (inserted === total) process.stdout.write('\n');
  };

  const log = (table: string, count: number) =>
    console.log(`  ${table.padEnd(14)} ${count.toLocaleString('en-US')} rows`);

  await insertRows(
    client,
    'companies',
    ['id', 'name', 'currency', 'timezone', 'is_demo', 'created_at'],
    [data.company],
  );
  log('companies', 1);

  await insertRows(
    client,
    'zones',
    [
      'id', 'company_id', 'name', 'code', 'polygon',
      'center_lat', 'center_lng', 'base_demand_weight', 'created_at',
    ],
    data.zones,
  );
  log('zones', data.zones.length);

  await insertRows(
    client,
    'vehicles',
    [
      'id', 'company_id', 'plate', 'type', 'fuel_type', 'fuel_efficiency_km_per_l',
      'fixed_cost_per_day', 'status', 'odometer_km', 'created_at',
    ],
    data.vehicles,
  );
  log('vehicles', data.vehicles.length);

  await insertRows(
    client,
    'drivers',
    [
      'id', 'company_id', 'full_name', 'phone', 'home_zone_id', 'vehicle_id',
      'shift_start', 'shift_end', 'cost_per_hour', 'status',
      'current_lat', 'current_lng', 'created_at',
    ],
    data.drivers,
  );
  log('drivers', data.drivers.length);

  await insertRows(
    client,
    'orders',
    [
      'id', 'company_id', 'order_number', 'zone_id', 'driver_id', 'status', 'channel',
      'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng', 'distance_km',
      'delivery_fee', 'promised_at', 'assigned_at', 'picked_up_at', 'delivered_at',
      'cancelled_at', 'cancel_reason', 'created_at',
    ],
    data.orders,
    { onProgress: progress('orders') },
  );

  await insertRows(
    client,
    'order_events',
    [
      'id', 'company_id', 'order_id', 'event_type', 'from_status', 'to_status',
      'occurred_at', 'meta', 'created_at',
    ],
    data.orderEvents,
    { onProgress: progress('order_events') },
  );

  await insertRows(
    client,
    'driver_shifts',
    [
      'id', 'company_id', 'driver_id', 'date', 'started_at', 'ended_at',
      'active_minutes', 'idle_minutes', 'created_at',
    ],
    data.driverShifts,
    { onProgress: progress('driver_shifts') },
  );
  if (data.driverShifts.length <= DEFAULT_CHUNK_SIZE) {
    log('driver_shifts', data.driverShifts.length);
  }

  await insertRows(
    client,
    'expenses',
    [
      'id', 'company_id', 'category', 'vehicle_id', 'driver_id',
      'amount', 'liters', 'occurred_at', 'created_at',
    ],
    data.expenses,
    { onProgress: progress('expenses') },
  );

  await insertRows(
    client,
    'alerts',
    [
      'id', 'company_id', 'type', 'severity', 'title', 'message', 'entity_type',
      'entity_id', 'metric', 'value', 'threshold', 'resolved_at', 'created_at',
    ],
    data.alerts,
  );
  log('alerts', data.alerts.length);
}

async function main(): Promise<void> {
  if (!hasDatabaseUrl()) {
    console.error(
      'DATABASE_URL is not set.\n\n' +
        'Copy .env.example to .env.local and set DATABASE_URL to your Supabase\n' +
        'connection string, then run `pnpm seed` again.\n\n' +
        'To check the generator without a database, run:\n' +
        '  pnpm tsx scripts/seed/dry-run.ts',
    );
    process.exitCode = 1;
    return;
  }

  // Fail early and clearly if the schema has not been created yet.
  const tables = await query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1)`,
    [[...ALL_TABLES]],
  );
  if (tables.length < ALL_TABLES.length) {
    console.error('Schema is incomplete. Run `pnpm db:migrate` first.');
    process.exitCode = 1;
    return;
  }

  if (!shouldReset) {
    const [existing] = await query<{ count: string }>('select count(*)::text from companies');
    if (existing && Number(existing.count) > 0) {
      console.error(
        'The database already contains data. Re-seeding would duplicate it.\n' +
          'Run `pnpm seed:reset` to truncate every table and seed from scratch.',
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log('Generating demo dataset ...');
  const startedAt = Date.now();
  const data = generateDataset();
  console.log(
    `Generated ${data.orders.length.toLocaleString('en-US')} orders in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.\n`,
  );

  await withTransaction(async (client) => {
    if (shouldReset) {
      console.log('Truncating existing data ...');
      await truncateAll(client);
    }
    console.log('Inserting:');
    await insertAll(client, data);
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nSeed complete in ${elapsed}s.`);

  printCounts(data);
  const ok = printVerification(data);

  if (!ok) {
    console.error(
      '\nOne or more checks failed. The data was still written, but the demo\n' +
        'stories may not read the way they are meant to.',
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error('\nSeed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (hasDatabaseUrl()) await closePool();
  });
