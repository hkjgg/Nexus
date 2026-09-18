-- ===========================================================================
-- NEXUS - Operations Intelligence Platform
-- Migration 0001: core schema
--
-- Conventions
--   * every table has  id uuid pk, company_id uuid fk, created_at timestamptz
--   * company_id is carried everywhere so the platform is multi-tenant ready
--   * all timestamps are timestamptz (UTC); presentation timezone lives on
--     companies.timezone
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles
--
-- Supabase ships the `anon` and `authenticated` roles; a plain Postgres (local
-- development, CI) does not, and the policies and grants below reference them
-- by name. Creating them when absent keeps one migration set working against
-- both, and is a no-op on Supabase.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type vehicle_type    as enum ('motorbike', 'van', 'truck');
  create type vehicle_status  as enum ('active', 'maintenance', 'idle');
  create type driver_status   as enum ('on_shift', 'off_shift', 'on_break');
  create type order_status    as enum (
    'pending', 'assigned', 'picked_up', 'in_transit',
    'delivered', 'delayed', 'cancelled', 'failed'
  );
  create type order_channel   as enum ('website', 'app', 'pos', 'marketplace', 'phone');
  create type expense_category as enum (
    'fuel', 'maintenance', 'driver_wage', 'vehicle_fixed', 'overhead'
  );
  create type alert_type      as enum ('operational', 'capacity', 'financial', 'fleet', 'anomaly');
  create type alert_severity  as enum ('info', 'warning', 'critical');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  currency    text        not null default 'USD',
  timezone    text        not null default 'UTC',
  is_demo     boolean     not null default false,
  created_at  timestamptz not null default now()
);

comment on column companies.is_demo is
  'Marks the public demo tenant. Only demo tenants are readable by anonymous users.';

-- ---------------------------------------------------------------------------
-- zones
-- ---------------------------------------------------------------------------
create table if not exists zones (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies (id) on delete cascade,
  name                text not null,
  code                text not null,
  polygon             jsonb not null,
  center_lat          double precision not null,
  center_lng          double precision not null,
  base_demand_weight  numeric(6, 3) not null default 1.0,
  created_at          timestamptz not null default now(),
  constraint zones_code_unique_per_company unique (company_id, code)
);

comment on column zones.polygon is 'GeoJSON Polygon geometry describing the zone boundary.';

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references companies (id) on delete cascade,
  plate                     text not null,
  type                      vehicle_type not null,
  fuel_type                 text not null default 'petrol',
  fuel_efficiency_km_per_l  numeric(6, 2) not null,
  fixed_cost_per_day        numeric(10, 2) not null default 0,
  status                    vehicle_status not null default 'active',
  odometer_km               numeric(12, 2) not null default 0,
  created_at                timestamptz not null default now(),
  constraint vehicles_plate_unique_per_company unique (company_id, plate)
);

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------
create table if not exists drivers (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies (id) on delete cascade,
  full_name      text not null,
  phone          text,
  home_zone_id   uuid references zones (id) on delete set null,
  vehicle_id     uuid references vehicles (id) on delete set null,
  shift_start    time not null default '08:00',
  shift_end      time not null default '20:00',
  cost_per_hour  numeric(10, 2) not null default 0,
  status         driver_status not null default 'off_shift',
  current_lat    double precision,
  current_lng    double precision,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies (id) on delete cascade,
  order_number   text not null,
  zone_id        uuid not null references zones (id) on delete restrict,
  driver_id      uuid references drivers (id) on delete set null,
  status         order_status not null default 'pending',
  channel        order_channel not null default 'app',
  pickup_lat     double precision not null,
  pickup_lng     double precision not null,
  dropoff_lat    double precision not null,
  dropoff_lng    double precision not null,
  distance_km    numeric(8, 2) not null,
  delivery_fee   numeric(10, 2) not null default 0,
  promised_at    timestamptz,
  assigned_at    timestamptz,
  picked_up_at   timestamptz,
  delivered_at   timestamptz,
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_at     timestamptz not null default now(),
  constraint orders_number_unique_per_company unique (company_id, order_number)
);

-- ---------------------------------------------------------------------------
-- order_events - immutable status-transition trail
-- ---------------------------------------------------------------------------
create table if not exists order_events (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  order_id     uuid not null references orders (id) on delete cascade,
  event_type   text not null,
  from_status  order_status,
  to_status    order_status,
  occurred_at  timestamptz not null,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- driver_shifts
-- ---------------------------------------------------------------------------
create table if not exists driver_shifts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies (id) on delete cascade,
  driver_id       uuid not null references drivers (id) on delete cascade,
  date            date not null,
  started_at      timestamptz,
  ended_at        timestamptz,
  active_minutes  integer not null default 0,
  idle_minutes    integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint driver_shifts_unique_per_day unique (driver_id, date)
);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  category     expense_category not null,
  vehicle_id   uuid references vehicles (id) on delete set null,
  driver_id    uuid references drivers (id) on delete set null,
  amount       numeric(12, 2) not null,
  liters       numeric(10, 2),
  occurred_at  timestamptz not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
create table if not exists alerts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  type         alert_type not null,
  severity     alert_severity not null default 'info',
  title        text not null,
  message      text not null,
  entity_type  text,
  entity_id    uuid,
  metric       text,
  value        numeric(14, 4),
  threshold    numeric(14, 4),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_zones_company            on zones (company_id);

create index if not exists idx_vehicles_company         on vehicles (company_id);
create index if not exists idx_vehicles_status          on vehicles (company_id, status);

create index if not exists idx_drivers_company          on drivers (company_id);
create index if not exists idx_drivers_home_zone        on drivers (home_zone_id);
create index if not exists idx_drivers_vehicle          on drivers (vehicle_id);

create index if not exists idx_orders_zone_created      on orders (zone_id, created_at desc);
create index if not exists idx_orders_status            on orders (company_id, status);
create index if not exists idx_orders_driver            on orders (driver_id);
create index if not exists idx_orders_company_created   on orders (company_id, created_at desc);
create index if not exists idx_orders_delivered_at      on orders (company_id, delivered_at desc)
  where delivered_at is not null;

create index if not exists idx_order_events_order       on order_events (order_id, occurred_at);
create index if not exists idx_order_events_company     on order_events (company_id, occurred_at desc);

create index if not exists idx_driver_shifts_driver     on driver_shifts (driver_id, date desc);
create index if not exists idx_driver_shifts_company    on driver_shifts (company_id, date desc);

create index if not exists idx_expenses_company_time    on expenses (company_id, occurred_at desc);
create index if not exists idx_expenses_category        on expenses (company_id, category, occurred_at desc);
create index if not exists idx_expenses_vehicle         on expenses (vehicle_id, occurred_at desc);

create index if not exists idx_alerts_company_created   on alerts (company_id, created_at desc);
create index if not exists idx_alerts_unresolved        on alerts (company_id, severity)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Realtime
-- Supabase streams changes for tables published on `supabase_realtime`.
-- `replica identity full` makes UPDATE/DELETE payloads carry the old row.
-- ---------------------------------------------------------------------------
alter table orders  replica identity full;
alter table drivers replica identity full;
alter table alerts  replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table orders;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drivers'
    ) then
      alter publication supabase_realtime add table drivers;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
    ) then
      alter publication supabase_realtime add table alerts;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Policy model for this milestone:
--   * RLS is ON for every table.
--   * Anonymous / authenticated visitors get READ-ONLY access, and only to
--     rows belonging to a company flagged `is_demo`.
--   * No insert/update/delete policies exist, so writes are only possible
--     with the service role key (which bypasses RLS). The seed engine and
--     migrations use the direct Postgres connection, so they are unaffected.
-- ---------------------------------------------------------------------------
alter table companies     enable row level security;
alter table zones         enable row level security;
alter table vehicles      enable row level security;
alter table drivers       enable row level security;
alter table orders        enable row level security;
alter table order_events  enable row level security;
alter table driver_shifts enable row level security;
alter table expenses      enable row level security;
alter table alerts        enable row level security;

-- Helper: is this company the public demo tenant?
create or replace function public.is_demo_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from companies c where c.id = p_company_id and c.is_demo
  );
$$;

drop policy if exists demo_read_companies on companies;
create policy demo_read_companies on companies
  for select to anon, authenticated using (is_demo);

drop policy if exists demo_read_zones on zones;
create policy demo_read_zones on zones
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_vehicles on vehicles;
create policy demo_read_vehicles on vehicles
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_drivers on drivers;
create policy demo_read_drivers on drivers
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_orders on orders;
create policy demo_read_orders on orders
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_order_events on order_events;
create policy demo_read_order_events on order_events
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_driver_shifts on driver_shifts;
create policy demo_read_driver_shifts on driver_shifts
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_expenses on expenses;
create policy demo_read_expenses on expenses
  for select to anon, authenticated using (public.is_demo_company(company_id));

drop policy if exists demo_read_alerts on alerts;
create policy demo_read_alerts on alerts
  for select to anon, authenticated using (public.is_demo_company(company_id));
