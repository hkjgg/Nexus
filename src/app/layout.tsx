/**
 * The application frame.
 *
 * Resolves the tenant and its zones once, here, so the top bar is populated on
 * the first paint of every page and no page has to ask for them again. When
 * there is no database to read - a fresh checkout, a missing DATABASE_URL -
 * the frame is replaced by instructions rather than rendered empty.
 */

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { AppShell, SetupNotice } from '@/components/shell';
import { getDemoCompany } from '@/lib/db/company';
import { hasDatabaseUrl } from '@/lib/db/env';
import { query } from '@/lib/db/pg';
import { DEFAULT_RANGE, ALL_ZONES } from '@/lib/filters';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NEXUS - Operations Intelligence',
  description:
    'Operations intelligence for delivery and logistics teams: live control tower, ' +
    'deterministic KPIs and AI-assisted analysis.',
};

// The frame reads live data, so it must not be cached at build time.
export const dynamic = 'force-dynamic';

const SETUP_STEPS = [
  'Copy .env.example to .env.local and set DATABASE_URL.',
  'Run pnpm db:migrate to create the schema.',
  'Run pnpm seed to generate 90 days of demo history.',
];

async function loadFrame() {
  if (!hasDatabaseUrl()) {
    return { error: 'DATABASE_URL is not set.' as const, company: null, zones: [] };
  }

  try {
    const company = await getDemoCompany();
    if (!company) {
      return { error: 'no-data' as const, company: null, zones: [] };
    }

    const zones = await query<{ code: string; name: string }>(
      'select code, name from zones where company_id = $1 order by code',
      [company.id],
    );

    return { error: null, company, zones };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      company: null,
      zones: [],
    };
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const frame = await loadFrame();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {frame.company ? (
          <AppShell
            companyName={frame.company.name}
            timeZone={frame.company.timezone}
            range={DEFAULT_RANGE}
            zone={ALL_ZONES}
            zones={frame.zones}
          >
            {children}
          </AppShell>
        ) : frame.error === 'no-data' ? (
          <SetupNotice
            title="No demo data yet"
            detail="The schema is in place but no company exists."
            steps={SETUP_STEPS.slice(2)}
          />
        ) : (
          <SetupNotice
            title="Not connected to a database"
            detail={frame.error ?? undefined}
            steps={SETUP_STEPS}
          />
        )}
      </body>
    </html>
  );
}
