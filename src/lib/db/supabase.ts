/**
 * Supabase clients.
 *
 * Used for Realtime subscriptions and for any browser-side reads, both of
 * which are governed by the Row Level Security policies in migration 0001.
 * Server-side aggregation goes through `pg.ts` instead.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { optionalEnv, requireEnv } from './env';

/**
 * Browser-safe client. The anon key is public by design: RLS limits it to
 * read-only access to the demo company.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

/**
 * Server-only client using the service role key, which bypasses RLS.
 * Never import this from a client component.
 */
export function createServiceSupabaseClient(): SupabaseClient {
  const serviceKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is required for server-side writes ' +
        'and must never be exposed to the browser.',
    );
  }
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), serviceKey, {
    auth: { persistSession: false },
  });
}
