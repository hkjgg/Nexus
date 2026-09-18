import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Database, PlugZap, ServerCrash } from 'lucide-react';
import { Card, EmptyState } from '@/components/nexus';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';
import { loadDashboardContext } from '@/lib/dashboard';

// Every screen reads live figures, so nothing here may be cached at build time.
export const dynamic = 'force-dynamic';

/**
 * The application shell: the sidebar down the left, the filter bar across the
 * top, and the section itself in the remaining space.
 *
 * The shell needs the tenant before it can label anything, so a database that
 * is missing, unreachable or empty is handled here once rather than in each of
 * the eight sections.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const context = await loadDashboardContext();

  if (context.status !== 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <SetupNotice context={context} />
      </div>
    );
  }

  const { company, zones } = context;

  return (
    <div className="min-h-screen">
      {/* The sidebar reads the URL to mark the active section, which is a
          client hook and so needs a boundary of its own. */}
      <Suspense fallback={<div className="hidden w-60 lg:block" />}>
        <Sidebar />
      </Suspense>

      <div className="lg:pl-60">
        <TopBar
          companyName={company.name}
          timezone={company.timezone}
          zones={zones.map((zone) => ({ code: zone.code, name: zone.name }))}
        />
        <main>{children}</main>
      </div>
    </div>
  );
}

function SetupNotice({
  context,
}: {
  context: Exclude<Awaited<ReturnType<typeof loadDashboardContext>>, { status: 'ok' }>;
}) {
  if (context.status === 'no-env') {
    return (
      <Card className="max-w-lg">
        <EmptyState
          icon={PlugZap}
          title="Not connected to a database"
          description="DATABASE_URL is not set. Copy .env.example to .env.local and fill it in, then run pnpm db:migrate followed by pnpm seed."
        />
      </Card>
    );
  }

  if (context.status === 'no-data') {
    return (
      <Card className="max-w-lg">
        <EmptyState
          icon={Database}
          title="No data yet"
          description="The schema is in place but no demo company exists. Run pnpm seed to generate 90 days of history, or trigger the Database setup workflow."
        />
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <EmptyState
        icon={ServerCrash}
        title="Could not reach the database"
        description={context.message}
      />
    </Card>
  );
}
