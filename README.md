# NEXUS

**Operations Intelligence Platform for delivery and logistics companies.**

NEXUS is a control tower: one place where an operations team sees what the
fleet is doing right now, what it cost, and what is about to go wrong. It
combines a live operational view, a deterministic KPI layer and — in later
milestones — an AI analyst that explains *why* a number moved.

This repository is built in public as a portfolio project, with a live demo
running on seeded but realistic data.

> **Status: Week 1 — foundations and the Command Center.** The schema, the
> demo data engine, the KPI layer, the design system and the first screen of
> the control tower are complete and verified. Seven more sections to build.

---

## What exists today

| Area | State |
| --- | --- |
| Postgres schema, indexes, Realtime, RLS | Done |
| Demo data engine (90 days, ~340k rows) | Done |
| Deterministic KPI layer, time series, per-zone breakdowns | Done |
| Design system: tokens and eight components | Done |
| App shell: sidebar, date range, zone filter, live clock | Done |
| Command Center: KPIs, chart, zone table, alerts, map | Done |
| Rule-based alert engine | Done |
| Live Map, Orders, Drivers, Fleet, Analytics, Simulator, AI Assistant | Not started |

## Stack

- **Next.js 15** (App Router) + **TypeScript** in strict mode
- **Tailwind CSS v4**, with the design tokens declared in `src/app/globals.css`
- **Supabase** (Postgres + Realtime) via `@supabase/supabase-js`
- **Recharts** for charts, **MapLibre GL** on CARTO's key-free dark basemap,
  **Framer Motion** for one purposeful entrance
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

The Command Center opens on the last seven days: eight KPI tiles with their
movement against the previous period, orders and on-time rate over the range,
the per-zone table, the alerts the rules found, and the service map. The date
range and zone filter live in the URL, so any view is shareable.

### Setting up a hosted database from CI

The **Database setup** workflow (`.github/workflows/db-setup.yml`) runs the
same two commands against the `DATABASE_URL` repository secret. Trigger it
from the Actions tab; it takes a `reset` box for a destructive reseed and a
`skip_seed` box for migrations only. Migrations are tracked in
`schema_migrations` and each file is idempotent, so re-running is safe.

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
| `pnpm kpi:test` | Print every headline KPI, last 7 days vs prior 7 |
| `pnpm kpi:test --by-zone` | The same, broken down per zone |

## Project layout

```
src/
  app/
    (app)/             the shell and every section inside it
  components/
    nexus/             the design system: eight primitives, nothing domain-aware
    shell/             sidebar, top bar, filters, live clock
    command-center/    the panels of the first screen
  lib/
    alerts/            the rule engine: pure functions over measurements
    db/                Postgres pool, Supabase clients, domain types
    kpi/               deterministic KPI queries, series, and formatting
    sim/               the demo data engine
    filters.ts         date range and zone, parsed from the URL
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

## Alerts

Alerts are generated on each request by four rules in `src/lib/alerts`, not
stored and not written by hand, so they can never contradict the numbers
beside them or linger after the problem is gone.

No rule names a zone, a vehicle or a driver. Each compares an entity with its
own peers — a zone against the median zone, a van against the other vans, a
driver against the median driver *in the same zone* — so the findings survive
a reseed. Every threshold is a ratio against a peer median and they all live
in one exported constant, `ALERT_THRESHOLDS`.

Against the seeded data the rules find exactly the four planted stories, and
nothing else.

## Design rules

- **No hard-coded numbers in the UI.** Everything reads from the database.
  Labels, formats and currency come from metadata and the company record.
- **KPIs are deterministic.** Arithmetic lives in SQL; TypeScript maps and
  formats.
- **One accent, three status colours.** Colour that is not the accent means
  something; a status colour never doubles as a chart series, and never
  carries meaning without an icon or a label beside it.
- **No dual-axis charts.** A count and a rate get two stacked panels sharing
  one x-axis, because aligning two y-scales invents a correlation the data
  does not contain.
- **Motion is purposeful.** One short staggered entrance, and it collapses to
  its end state under `prefers-reduced-motion`.
- **Typed throughout.** Strict TypeScript, with domain types mirroring the
  schema in `src/lib/db/types.ts`.

## License

MIT
