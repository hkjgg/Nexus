/**
 * The Command Center.
 *
 * Everything on this page is read from Postgres at request time through the
 * KPI layer and the alert rules; there is not a single hard-coded figure in
 * it. Each panel is its own async component behind a Suspense boundary, so the
 * page frame paints immediately and each panel fills in as its query returns
 * rather than the whole screen waiting on the slowest one.
 */

import { Suspense } from 'react';
import {
  Card,
  Reveal,
  SectionHeader,
  SkeletonKpiGrid,
  SkeletonPanel,
  StatusBadge,
} from '@/components/nexus';
import { AlertsPanel } from '@/components/command-center/AlertsPanel';
import { KpiGrid } from '@/components/command-center/KpiGrid';
import { TrendChart, type TrendPoint } from '@/components/command-center/TrendChart';
import { ZoneMap } from '@/components/command-center/ZoneMap';
import { ZoneTable } from '@/components/command-center/ZoneTable';
import { ALERT_WINDOW_DAYS, generateAlerts } from '@/lib/alerts';
import { getDemoCompany, type CompanyContext } from '@/lib/db/company';
import { query } from '@/lib/db/pg';
import { getDriverPositions } from '@/lib/fleet/positions';
import {
  ALL_ZONES,
  PARAM,
  RANGE_META,
  parseRangeKey,
  parseZoneCode,
  resolvePreviousRange,
  resolveRange,
  type RangeKey,
} from '@/lib/filters';
import { getKpiComparisonAgainst, getKpiSeries, getZonePerformance } from '@/lib/kpi';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

/** Everything the panels need to agree on, resolved once per request. */
type ViewContext = {
  company: CompanyContext;
  rangeKey: RangeKey;
  range: { from: Date; to: Date };
  /** The window the KPI deltas are measured against. */
  previousRange: { from: Date; to: Date };
  zoneCode: string;
  zoneId: string | null;
};

async function resolveView(searchParams: SearchParams): Promise<ViewContext | null> {
  const company = await getDemoCompany();
  if (!company) return null;

  const rangeKey = parseRangeKey(searchParams[PARAM.range]);
  const zoneCode = parseZoneCode(searchParams[PARAM.zone]);

  let zoneId: string | null = null;
  if (zoneCode !== ALL_ZONES) {
    const rows = await query<{ id: string }>(
      'select id from zones where company_id = $1 and code = $2',
      [company.id, zoneCode],
    );
    zoneId = rows[0]?.id ?? null;
  }

  // One clock reading for both windows, so they cannot disagree by a tick.
  const now = new Date();

  return {
    company,
    rangeKey,
    range: resolveRange(rangeKey, company.timezone, now),
    previousRange: resolvePreviousRange(rangeKey, company.timezone, now),
    zoneCode,
    zoneId,
  };
}

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const view = await resolveView(await searchParams);

  // The layout renders setup instructions when there is no tenant; reaching
  // here without one would mean the database emptied mid-request.
  if (!view) return null;

  const meta = RANGE_META[view.rangeKey];
  const zoneLabel = view.zoneCode === ALL_ZONES ? 'All zones' : `Zone ${view.zoneCode}`;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          as="h1"
          title="Command Center"
          description={`${meta.longLabel} · ${zoneLabel} · all figures read from the operations database`}
        />
        <StatusBadge tone="accent" dot>
          Live
        </StatusBadge>
      </div>

      <Suspense fallback={<SkeletonKpiGrid />}>
        <KpiSection view={view} />
      </Suspense>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-2" delay={0.04}>
          <Card>
            <SectionHeader
              title="Volume and service level"
              description={`Orders placed and the share delivered inside the promised window, by ${meta.bucket}`}
            />
            <div className="mt-4">
              <Suspense fallback={<SkeletonPanel height="h-64" />}>
                <TrendSection view={view} />
              </Suspense>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card flush className="flex max-h-[32rem] flex-col">
            <div className="p-4 pb-3">
              <SectionHeader
                title="Alerts"
                description={`Rule-based scan of the last ${ALERT_WINDOW_DAYS} days`}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<SkeletonPanel lines={3} />}>
                <AlertsSection view={view} />
              </Suspense>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-2" delay={0.12}>
          <Card flush>
            <div className="p-4 pb-2">
              <SectionHeader title="Zone performance" description="Worst on-time rate first" />
            </div>
            <Suspense fallback={<SkeletonPanel lines={4} />}>
              <ZoneTableSection view={view} />
            </Suspense>
          </Card>
        </Reveal>

        <Reveal delay={0.16}>
          <Card flush>
            <div className="p-4 pb-3">
              <SectionHeader
                title="Zone map"
                description="Polygons by on-time rate, dots are last known driver positions"
              />
            </div>
            <Suspense fallback={<SkeletonPanel height="h-72" />}>
              <MapSection view={view} />
            </Suspense>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panels. Each one owns its query, so each one streams in on its own.
// ---------------------------------------------------------------------------

async function KpiSection({ view }: { view: ViewContext }) {
  const meta = RANGE_META[view.rangeKey];

  const [comparison, series] = await Promise.all([
    getKpiComparisonAgainst(
      {
        companyId: view.company.id,
        from: view.range.from,
        to: view.range.to,
        zoneId: view.zoneId,
      },
      view.previousRange,
    ),
    getKpiSeries({
      companyId: view.company.id,
      from: view.range.from,
      to: view.range.to,
      zoneId: view.zoneId,
      bucket: meta.bucket,
      timeZone: view.company.timezone,
    }),
  ]);

  return (
    <KpiGrid
      comparison={comparison}
      series={series}
      currency={view.company.currency}
      comparisonLabel={meta.comparisonLabel}
    />
  );
}

async function TrendSection({ view }: { view: ViewContext }) {
  const meta = RANGE_META[view.rangeKey];

  const series = await getKpiSeries({
    companyId: view.company.id,
    from: view.range.from,
    to: view.range.to,
    zoneId: view.zoneId,
    bucket: meta.bucket,
    timeZone: view.company.timezone,
  });

  const tickFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: view.company.timezone,
    ...(meta.bucket === 'hour'
      ? { hour: 'numeric', hour12: true }
      : { month: 'short', day: 'numeric' }),
  });

  const fullFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: view.company.timezone,
    ...(meta.bucket === 'hour'
      ? { weekday: 'short', hour: 'numeric', hour12: true }
      : { weekday: 'short', month: 'short', day: 'numeric' }),
  });

  const data: TrendPoint[] = series.map((point) => ({
    label: tickFormat.format(point.bucketStart),
    fullLabel: fullFormat.format(point.bucketStart),
    orders: point.ordersCount,
    onTimePercent: point.onTimeRate === null ? null : point.onTimeRate * 100,
  }));

  return <TrendChart data={data} />;
}

async function AlertsSection({ view }: { view: ViewContext }) {
  const alerts = await generateAlerts({
    companyId: view.company.id,
    timeZone: view.company.timezone,
    zoneCode: view.zoneCode === ALL_ZONES ? null : view.zoneCode,
  });

  return <AlertsPanel alerts={alerts} timeZone={view.company.timezone} />;
}

async function ZoneTableSection({ view }: { view: ViewContext }) {
  const zones = await getZonePerformance(view.company.id, view.range);
  return <ZoneTable zones={zones} currency={view.company.currency} />;
}

async function MapSection({ view }: { view: ViewContext }) {
  const [zones, drivers] = await Promise.all([
    getZonePerformance(view.company.id, view.range),
    getDriverPositions(view.company.id),
  ]);

  return (
    <ZoneMap
      zones={zones.map((zone) => ({
        code: zone.code,
        name: zone.name,
        polygon: zone.polygon,
        onTimeRate: zone.onTimeRate,
        ordersCount: zone.ordersCount,
      }))}
      drivers={drivers.map((driver) => ({
        driverId: driver.driverId,
        fullName: driver.fullName,
        lat: driver.lat,
        lng: driver.lng,
      }))}
      focusZoneCode={view.zoneCode === ALL_ZONES ? null : view.zoneCode}
    />
  );
}
