/**
 * Direct Postgres access for server-side code: migrations, the seed engine and
 * the KPI layer.
 *
 * The browser never reaches this module. Anything the browser needs goes
 * through Supabase with the anon key, where Row Level Security applies.
 */

import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { requireEnv } from './env';

let pool: Pool | undefined;

/**
 * Supabase requires TLS, but a local Postgres started for development or CI
 * usually has it switched off, and `sslmode=disable` in the URL is an explicit
 * opt-out. Deciding here keeps the same code path working against both.
 */
function shouldUseSsl(connectionString: string): boolean {
  if (/[?&]sslmode=disable\b/.test(connectionString)) return false;
  try {
    const { hostname } = new URL(connectionString);
    return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1';
  } catch {
    // Not a URL we can parse - assume a managed host and keep TLS on.
    return true;
  }
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = requireEnv('DATABASE_URL');
    pool = new Pool({
      connectionString,
      // Supabase terminates TLS with its own certificate chain, which Node
      // does not have a root for; verification is therefore relaxed.
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
      // Deliberately small. On Vercel every serverless instance gets its own
      // pool, so a generous `max` multiplied by the instance count is how a
      // Postgres runs out of connections under load. Two is enough for the
      // handful of parallel queries a page issues, and the pooler absorbs the
      // rest.
      max: 2,
      idleTimeoutMillis: 30_000,
      // Fail fast rather than hanging a request when the database is
      // unreachable - the UI has something useful to say about that.
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** Runs `fn` inside a transaction, rolling back on any error. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
