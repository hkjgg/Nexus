import { Suspense } from 'react';
import { ChartSkeleton, KpiTileSkeleton, PanelSkeleton } from '@/components/nexus';
import { AlertsPanel } from '@/components/command-center/alerts-panel';
import { KpiGrid } from '@/components/command-center/kpi-grid';
import { MapPanel } from '@/components/command-center/map-panel';
import { PerformanceChart, type ChartPoint } from '@/components/command-center/performance-chart';
import type { MapDriver } from '@/components/command-center/zone-map';
import { ZoneTable } from '@/components/command-center/zone-table';
import { generateAlerts } from '@/lib/alerts';
import { loadDashboardContext } from '@/lib/dashboard';
import {
  comparisonLabel,
  parseRange,
  parseZone,
  RANGE_PARAM,
  resolveRange,
  ZONE_PARAM,
  type SearchParams,
} from '@/lib/filters';
import {
  bucketForRange,
  getDriverPositions,
  getKpiComparison,
  getTimeSeries,
  getZonePerformance,
  type Company,
  type SeriesPoint,
  type ZoneSummary,
} from '@/lib/kpi';
import type { DateRange } from '@/lib/kpi/types';

export const dynamic = 'force-dynamic';

/**
 * The Command Center.
 *
 * Every figure on it comes from the KPI layer, which computes in SQL. Nothing
 * is hard-coded, and no panel does arithmetic of its own, so two numbers on
 * the screen can never disagree about the same question.
 *
 * The page resolves the filters once and hands the same range and zone to
 * every panel. Each panel then loads behind its own Suspense boundary, so the
 * KPI row does not wait for the map and a slow query degrades one card
 * instead of the screen.
 */
export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadDashboardContext();
  // The shell has already rendered the setup notice in this case.
  if (context.status !== 'ok') return null;

  const params = await searchParams;
  const { company, zones } = context;

  const rangeKey = parseRange(params[RANGE_PARAM]);
  const range = resolveRange(rangeKey, company.timezone);
  const zoneCode = parseZone(params[ZONE_PARAM]);
  const zone = zoneCode ? (zones.find((candidate) => candidate.code === zoneCode) ?? null) : null;

  const scope = {
    companyId: company.id,
    from: range.from,
    to: range.to,
    zoneId: zone?.id ?? null,
  };

  return (
    <div className="space-y-3 p-4">
      <Suspense fallback={<KpiGridSkeleton />}>
        <KpiSection
          company={company}
          scope={scope}
          range={range}
          comparison={comparisonLabel(rangeKey)}
        />
      </Suspense>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Suspense fallback={<ChartSkeleton />}>
            <ChartSection company={company} scope={scope} range={range} />
          </Suspense>
        </div>

        <div className="xl:col-span-5">
          <Suspense fallback={<PanelSkeleton rows={4} />}>
            <AlertsSection company={company} range={range} />
          </Suspense>
        </div>

        <div className="xl:col-span-7">
          <Suspense fallback={<PanelSkeleton rows={8} />}>
            <ZoneSection company={company} range={range} />
          </Suspense>
        </div>

        <div className="xl:col-span-5">
          <Suspense fallback={<PanelSkeleton rows={6} />}>
            <MapSection company={company} zones={zones} range={range} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

type Scope = { companyId: string; from: Date; to: Date; zoneId: string | null };

async function KpiSection({
  company,
  scope,
  range,
  comparison,
}: {
  company: Company;
  scope: Scope;
  range: DateRange;
  comparison: string;
}) {
  const [kpis, series] = await Promise.all([
    getKpiComparison(scope),
    getTimeSeries({
      ...scope,
      bucket: bucketForRange(range.from, range.to),
      timezone: company.timezone,
    }),
  ]);

  return (
    <KpiGrid
      comparison={kpis}
      series={series}
      currency={company.currency}
      comparisonLabel={comparison}
    />
  );
}

async function ChartSection({
  company,
  scope,
  range,
}: {
  company: Company;
  scope: Scope;
  range: DateRange;
}) {
  const bucket = bucketForRange(range.from, range.to);
  const series = await getTimeSeries({ ...scope, bucket, timezone: company.timezone });

  return (
    <PerformanceChart
      points={toChartPoints(series, bucket, company.timezone)}
      averageOnTimeRate={weightedOnTimeRate(series)}
      bucketLabel={bucket}
    />
  );
}

async function AlertsSection({ company, range }: { company: Company; range: DateRange }) {
  // Alerts are company-wide on purpose: the rules work by comparing an entity
  // with its peers, and a zone filter would leave them nothing to compare
  // against.
  const alerts = await generateAlerts({
    companyId: company.id,
    range,
    timezone: company.timezone,
  });

  return <AlertsPanel alerts={alerts} />;
}

async function ZoneSection({ company, range }: { company: Company; range: DateRange }) {
  const zones = await getZonePerformance({
    companyId: company.id,
    from: range.from,
    to: range.to,
  });
  return <ZoneTable zones={zones} />;
}

async function MapSection({
  company,
  zones,
  range,
}: {
  company: Company;
  zones: readonly ZoneSummary[];
  range: DateRange;
}) {
  const [performance, drivers] = await Promise.all([
    getZonePerformance({ companyId: company.id, from: range.from, to: range.to }),
    getDriverPositions(company.id),
  ]);

  const byId = new Map(performance.map((entry) => [entry.zoneId, entry]));

  return (
    <MapPanel
      zones={zones.map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        polygon: zone.polygon,
        onTimeRate: byId.get(zone.id)?.onTimeRate ?? null,
        ordersCount: byId.get(zone.id)?.ordersCount ?? 0,
      }))}
      drivers={drivers.map((driver): MapDriver => ({
        id: driver.id,
        fullName: driver.fullName,
        status: driver.status,
        lat: driver.lat,
        lng: driver.lng,
        live: driver.source === 'live',
      }))}
    />
  );
}

/**
 * Bucket labels are formatted on the server, in the company's timezone, so
 * the axis reads the same for everyone regardless of where the browser is.
 */
function toChartPoints(
  series: readonly SeriesPoint[],
  bucket: 'hour' | 'day',
  timezone: string,
): ChartPoint[] {
  // Buckets arrive as local wall-clock times with no offset, so they are
  // formatted in UTC to read back exactly what the database cut.
  const short = new Intl.DateTimeFormat(
    'en-GB',
    bucket === 'hour'
      ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', timeZone: 'UTC' },
  );
  const full = new Intl.DateTimeFormat(
    'en-GB',
    bucket === 'hour'
      ? {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          hour12: false,
          timeZone: 'UTC',
        }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  );

  return series.map((point) => ({
    key: point.bucketStart.toISOString(),
    label: short.format(point.bucketStart),
    fullLabel: `${full.format(point.bucketStart)} (${timezone})`,
    orders: point.ordersCount,
    onTimeRate: point.onTimeRate,
  }));
}

/**
 * The period's on-time rate, weighted by deliveries rather than averaged
 * across buckets: a quiet hour with one late order must not count as much as
 * a peak hour with two hundred on time.
 */
function weightedOnTimeRate(series: readonly SeriesPoint[]): number | null {
  let onTime = 0;
  let total = 0;
  for (const point of series) {
    if (point.onTimeRate === null) continue;
    onTime += point.onTimeRate * point.deliveredCount;
    total += point.deliveredCount;
  }
  return total === 0 ? null : onTime / total;
}

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <KpiTileSkeleton key={index} />
      ))}
    </div>
  );
}
