# NEXUS

**Operations Intelligence Platform for delivery and logistics companies.**

NEXUS is a control tower: one place where an operations team sees what the
fleet is doing right now, what it cost, and what is about to go wrong. It
combines a live operational view, a deterministic KPI layer and — in later
milestones — an AI analyst that explains *why* a number moved.

This repository is built in public as a portfolio project, with a live demo
running on seeded but realistic data.

> **Status: Week 1 — foundations and the Command Center.** The schema, the
> demo data engine and the KPI layer are complete and verified, and the
> Command Center is built on top of them. The other seven sections of the
> product are routed and stated but not yet built.

---

## What exists today

| Area | State |
| --- | --- |
| Postgres schema, indexes, Realtime, RLS | Done |
| Demo data engine (90 days, ~338k rows) | Done |
| Deterministic KPI layer | Done |
| Design system, tokens and component library | Done |
| App shell: navigation, range and zone filters | Done |
| Command Center: KPIs, trend, zones, alerts, map | Done |
| Live Map, Orders, Drivers, Fleet, Analytics | Not started |
| Simulator, AI analyst | Not started |

## Stack

- **Next.js 15** (App Router) + **TypeScript** in strict mode
- **Tailwind CSS v4**, dark-first design tokens declared as CSS variables
- **Supabase** (Postgres + Realtime) via `@supabase/supabase-js`
- **Recharts** for charts, **MapLibre GL** with CARTO basemap tiles (no API
  key), **Framer Motion** for the little motion there is
- **pnpm**, deployed to **Vercel**

## Getting started

### 1. Install

```bash
pnpm install
```

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`. From your Supabase project:

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Looks like `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon / publishable key | Public by design; constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key | **Server only.** Bypasses RLS |
| `DATABASE_URL` | Project Settings → Database → Connection string (URI) | Used by migrations, seed and server-side KPI queries |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Only needed once the AI analyst lands |

Each variable holds a distinct value — it is worth double-checking that the
URL really is a URL and the keys are not swapped, since a mismatch surfaces
later as a confusing authentication error rather than a clear one.

### 3. Create the schema

```bash
pnpm db:migrate
```

Applies every file in `supabase/migrations` in order and records what ran in
`schema_migrations`, so it is safe to run repeatedly.

### 4. Seed the demo data

```bash
pnpm seed          # refuses to run if data already exists
pnpm seed:reset    # truncates every table, then reseeds
```

Generates roughly 338,000 rows in about ten seconds, then prints row counts
and a pass/fail line for every demo story and baseline target.

### 5. Run it

```bash
pnpm dev
```

The Command Center opens on the last seven days across all zones: eight
headline KPIs with a delta against the same window before it, orders and
on-time rate over the range, zone performance, rule-based alerts and a zone
map. Both filters live in the URL, so `/?range=30d&zone=Z04` is a link worth
sending to a colleague.

### Applying migrations from CI

Direct Postgres connections to Supabase are blocked from some environments.
The **Database setup** workflow (`.github/workflows/db-setup.yml`) runs the
migrations, and optionally the seed, from a GitHub runner instead. It needs a
`DATABASE_URL` repository secret and is started by hand from the Actions tab.

### Without a database

The data engine is pure and needs no connection, so you can exercise and
verify it on its own:

```bash
pnpm tsx scripts/seed/dry-run.ts
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier, write mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm seed` | Generate and insert the demo dataset |
| `pnpm seed:reset` | Truncate everything, then reseed |
| `pnpm kpi:test` | Print all ten KPIs, last 7 days vs prior 7 |
| `pnpm kpi:test --by-zone` | The same, broken down per zone |

## Project layout

```
src/
  app/                 Next.js App Router pages
  components/
    nexus/             the design system: tiles, cards, tables, badges
    shell/             navigation rail, top bar, filters
    command-center/    the Command Center's panels
  lib/
    alerts/            rule-based alert generation
    db/                Postgres pool, Supabase clients, domain types
    fleet/             driver positions
    kpi/               deterministic KPI queries, series and formatting
    sim/               the demo data engine
scripts/
  migrate.ts           migration runner
  kpi-test.ts          KPI comparison report
  seed/                seed entry point, batch insert, dry run
supabase/
  migrations/          SQL migrations, applied in filename order
```

## Data model

Nine tables, every one carrying `id`, `company_id` and `created_at` so the
platform is multi-tenant ready from the first commit.

`companies` · `zones` · `vehicles` · `drivers` · `orders` · `order_events` ·
`driver_shifts` · `expenses` · `alerts`

- **Realtime** is enabled on `orders`, `drivers` and `alerts`.
- **Row Level Security** is enabled on every table. Anonymous and authenticated
  visitors get read-only access, and only to the company flagged `is_demo`.
  No write policies exist, so the public demo cannot modify anything and cannot
  see other tenants. Writes require the service role key or a direct Postgres
  connection.

## KPI layer

Ten metrics, all computed in SQL by `kpi_summary(company_id, from, to, zone_id)`
and returned in a single round trip:

revenue · orders · delivery success rate · on-time rate · average delivery time ·
fleet utilisation · cost per delivery · profit · delay rate · cancellation rate

Every metric accepts a date range and an optional zone. The range is half-open,
`[from, to)`. The definitions are documented inline in
`supabase/migrations/0002_kpi_functions.sql`.

Two further functions, added in `0003_dashboard_queries.sql`, use the same
expressions over the same tables so a point on a chart can never disagree with
the tile above it:

- `kpi_series(...)` buckets the headline metrics by hour or by day and returns
  empty buckets as zero rows, so a chart does not silently skip a quiet night.
- `zone_performance(...)` returns one row per zone, geometry included, so the
  zone table and the map are fed by a single round trip.

These numbers are **deterministic**: the same rows and the same arguments
always produce the same output. No AI touches them. The AI layer, when it
arrives, will explain and contextualise these figures — never compute them.

Two details worth knowing:

- Expenses are not attributed to a zone at source (fuel belongs to a vehicle,
  overhead to the company), so zone-scoped cost figures are allocated pro-rata
  by that zone's share of delivered volume.
- Daily costs post when the operating day closes. A rolling window of N days
  therefore contains exactly N daily postings, which is what keeps
  period-over-period comparisons honest.

## Alerts

Alerts are derived from the current contents of the database by the rules in
`src/lib/alerts`, never read from the `alerts` table, so an alert disappears
the moment the condition behind it does. Four rules fire today: a zone whose
demand has outgrown the drivers based in it, a vehicle burning more fuel per
kilometre than its peers, a lopsided roster, and a single day where delays
spiked clear of the rest.

Each rule compares a subject against its own peers rather than a fixed number,
so they keep working as the operation grows. Thresholds live in one file,
`src/lib/alerts/rules.ts`. The scan window is a fixed fourteen days rather than
the range selected in the top bar: filtering the dashboard down to today should
not hide the van that has been drinking fuel all fortnight.

## The demo data engine

`src/lib/sim` generates a 90-day operating history for a fictional company,
**Swift Parcel Co.** — 8 zones, 34 vehicles, 40 drivers, around 600 orders a
day, with a full event trail, driver shifts and expenses.

Every random draw, including UUIDs, comes from a seeded PRNG, so the same seed
on the same calendar day produces byte-identical data. The history is anchored
to the present so the demo always looks live, which means re-seeding tomorrow
shifts the window by a day; pass `options.now` to pin it.

The simulation models an hourly demand curve (lunch and dinner peaks, quiet
overnight), a Friday uplift, per-zone traffic, and outcome rates of roughly 4%
cancellations, 1% failures and 8% late under normal conditions. Orders that are
still in flight right now keep in-flight statuses rather than carrying future
timestamps.

### The four demo stories

The dataset contains four deliberate patterns. They are not labelled in the
data — analytics, and later the AI analyst, have to find them.

1. **Zone Z04 is outgrowing its capacity.** Order volume climbs about 38% over
   the last 14 days while assigned driver headcount stays flat, pushing
   utilisation past 90% and driving the delay rate up with it.
2. **One van is drinking fuel.** Van `SP-V03` burns roughly 30% more fuel per
   kilometre than the other vans, despite a comparable registered efficiency.
3. **Two drivers are carrying the team.** Two drivers handle about 40% more
   deliveries than the median driver.
4. **A rain day, nine days ago.** Average delivery time jumps from ~32 to
   ~51 minutes and the delay rate spikes to roughly 40%.

Both `pnpm seed` and the dry run verify all four, plus the baseline
statistical targets, and print a pass/fail line for each. A story that stops
holding fails loudly at seed time rather than quietly at demo time.

## Design rules

- **No hard-coded numbers in the UI.** Everything reads from the database.
  Labels, formats and currency come from metadata and the company record.
- **KPIs are deterministic.** Arithmetic lives in SQL; TypeScript maps and
  formats.
- **Typed throughout.** Strict TypeScript, with domain types mirroring the
  schema in `src/lib/db/types.ts`.

## License

MIT
