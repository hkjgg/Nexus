/**
 * Applies every SQL file in supabase/migrations, in filename order.
 *
 *   pnpm db:migrate
 *
 * Applied migrations are recorded in `schema_migrations`, so re-running is
 * safe and only new files execute. Each file runs inside its own transaction.
 */

import './env';

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { closePool, getPool, query, withTransaction } from '@/lib/db/pg';
import { hasDatabaseUrl } from '@/lib/db/env';

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');

async function main(): Promise<void> {
  if (!hasDatabaseUrl()) {
    console.error(
      'DATABASE_URL is not set.\n\n' +
        'Copy .env.example to .env.local and set DATABASE_URL to your Supabase\n' +
        'connection string, then run `pnpm db:migrate` again.',
    );
    process.exitCode = 1;
    return;
  }

  await query(`
    create table if not exists schema_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await query<{ name: string }>('select name from schema_migrations')).map((r) => r.name),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip    ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  apply   ${file} ... `);

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
    });

    console.log('done');
    ran += 1;
  }

  console.log(
    ran === 0
      ? '\nSchema already up to date.'
      : `\nApplied ${ran} migration${ran === 1 ? '' : 's'}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // getPool() is only constructed when DATABASE_URL exists.
    if (hasDatabaseUrl()) await closePool();
  });
