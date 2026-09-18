/**
 * Placeholder home page for Week 1.
 *
 * Its only job is to prove the pipeline end to end: Postgres -> the SQL KPI
 * function -> the typed KPI layer -> a server component. Every number below is
 * read from the database at request time; none of them is hard-coded. The real
 * control tower UI replaces this page in a later milestone.
 */

import { hasDatabaseUrl } from '@/lib/db/env';
import { query } from '@/lib/db/pg';
import {
  KPI_KEYS,
  KPI_META,
  formatDelta,
  formatKpi,
  getKpiComparison,
  lastNDays,
  percentChange,
  precedingWindow,
} from '@/lib/kpi';

// KPIs are read live, so the page must not be cached at build time.
export const dynamic = 'force-dynamic';

type DemoCompany = { id: string; name: string; currency: string; timezone: string };

async function loadCompany(): Promise<DemoCompany | null> {
  const rows = await query<DemoCompany>(
    'select id, name, currency, timezone from companies where is_demo order by created_at limit 1',
  );
  return rows[0] ?? null;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-xl rounded-lg border border-neutral-300 p-6 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">{children}</div>
    </div>
  );
}

export default async function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-mono text-4xl font-bold tracking-[0.2em]">NEXUS</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Operations Intelligence Platform
        </p>
      </header>

      {await renderKpis()}
    </main>
  );
}

async function renderKpis() {
  if (!hasDatabaseUrl()) {
    return (
      <Notice title="Not connected to a database">
        <p>
          <code>DATABASE_URL</code> is not set. Copy <code>.env.example</code> to{' '}
          <code>.env.local</code> and fill it in.
        </p>
        <p>
          Then run <code>pnpm db:migrate</code> followed by <code>pnpm seed</code>.
        </p>
      </Notice>
    );
  }

  let company: DemoCompany | null;
  try {
    company = await loadCompany();
  } catch (error) {
    return (
      <Notice title="Could not reach the database">
        <p>{error instanceof Error ? error.message : String(error)}</p>
        <p>
          Check <code>DATABASE_URL</code>, then run <code>pnpm db:migrate</code>.
        </p>
      </Notice>
    );
  }

  if (!company) {
    return (
      <Notice title="No data yet">
        <p>
          The schema is in place but no demo company exists. Run <code>pnpm seed</code> to generate
          90 days of history.
        </p>
      </Notice>
    );
  }

  const range = lastNDays(7);
  const prior = precedingWindow(range);
  const { current, previous } = await getKpiComparison({
    companyId: company.id,
    from: range.from,
    to: range.to,
  });

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: company.timezone,
    }).format(date);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{company.name}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Last 7 days &middot; {formatDate(range.from)} to {formatDate(range.to)}
          <span className="block">
            Compared with {formatDate(prior.from)} to {formatDate(prior.to)}
          </span>
        </p>
      </div>

      <dl className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {KPI_KEYS.map((key) => {
          const meta = KPI_META[key];
          const change = percentChange(current[key], previous[key]);
          const improved =
            change === null || change === 0 ? null : meta.higherIsBetter === change > 0;

          return (
            <div key={key} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-neutral-600 dark:text-neutral-400">{meta.label}</dt>
              <dd className="flex items-baseline gap-3">
                <span className="font-mono text-base font-medium tabular-nums">
                  {formatKpi(current[key], meta.format, { currency: company.currency })}
                </span>
                <span
                  className={[
                    'w-16 text-right font-mono text-xs tabular-nums',
                    improved === null
                      ? 'text-neutral-500'
                      : improved
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                  ].join(' ')}
                >
                  {formatDelta(change)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-6 text-xs text-neutral-500">
        Every figure is read from Postgres at request time. This page exists only to prove the
        pipeline works end to end.
      </p>
    </section>
  );
}
