/**
 * What every dashboard screen needs before it can render anything: the
 * tenant and its zones.
 *
 * The three failure modes - no connection string, a database that will not
 * answer, an empty schema - are returned as data rather than thrown, because
 * each one has its own thing to tell the person looking at the screen, and
 * none of them is a crash.
 */

import { hasDatabaseUrl } from '@/lib/db/env';
import { getDemoCompany, getZones, type Company, type ZoneSummary } from '@/lib/kpi/company';

export type DashboardContext =
  | { status: 'ok'; company: Company; zones: ZoneSummary[] }
  | { status: 'no-env' }
  | { status: 'no-data' }
  | { status: 'error'; message: string };

export async function loadDashboardContext(): Promise<DashboardContext> {
  if (!hasDatabaseUrl()) return { status: 'no-env' };

  try {
    const company = await getDemoCompany();
    if (!company) return { status: 'no-data' };

    const zones = await getZones(company.id);
    return { status: 'ok', company, zones };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
