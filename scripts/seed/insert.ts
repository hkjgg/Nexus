/**
 * Batched multi-row INSERT helper.
 *
 * Postgres caps a statement at 65535 bound parameters, so the chunk size is
 * reduced automatically when a table has many columns. Everything runs on a
 * caller-supplied client so the whole seed can live in one transaction.
 */

import type { PoolClient } from 'pg';

const MAX_BIND_PARAMS = 60_000;
export const DEFAULT_CHUNK_SIZE = 1000;

export type InsertOptions = {
  chunkSize?: number;
  /** Called after each chunk with the running total, for progress output. */
  onProgress?: (inserted: number, total: number) => void;
};

export async function insertRows<T extends Record<string, unknown>>(
  client: PoolClient,
  table: string,
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
  options: InsertOptions = {},
): Promise<number> {
  if (rows.length === 0) return 0;

  const requested = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkSize = Math.max(1, Math.min(requested, Math.floor(MAX_BIND_PARAMS / columns.length)));
  const columnList = columns.map((c) => `"${c}"`).join(', ');

  let inserted = 0;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const tuples: string[] = [];

    for (const row of chunk) {
      const placeholders: string[] = [];
      for (const column of columns) {
        values.push(normalize(row[column]));
        placeholders.push(`$${values.length}`);
      }
      tuples.push(`(${placeholders.join(', ')})`);
    }

    await client.query(`insert into ${table} (${columnList}) values ${tuples.join(', ')}`, values);

    inserted += chunk.length;
    options.onProgress?.(inserted, rows.length);
  }

  return inserted;
}

/** jsonb columns must be sent as text; everything else passes through. */
function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}
