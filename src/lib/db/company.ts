/**
 * The tenant the interface is rendering.
 *
 * Week 1 has exactly one: the public demo company. Resolving it here rather
 * than in a page keeps every page ready for the moment a real tenant arrives
 * from a session.
 */

import { query } from './pg';

export type CompanyContext = {
  id: string;
  name: string;
  /** ISO 4217 code, used for every money figure on screen. */
  currency: string;
  /** IANA zone; "today" and every chart bucket are aligned to it. */
  timezone: string;
};

export async function getDemoCompany(): Promise<CompanyContext | null> {
  const rows = await query<CompanyContext>(
    'select id, name, currency, timezone from companies where is_demo order by created_at limit 1',
  );
  return rows[0] ?? null;
}
