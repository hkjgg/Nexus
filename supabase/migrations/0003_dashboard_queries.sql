-- ===========================================================================
-- NEXUS - Migration 0003: Command Center query layer
--
-- Two set-returning functions that sit beside kpi_summary (migration 0002) and
-- use exactly the same metric definitions, so a number in the trend chart can
-- never disagree with the same number on a KPI tile.
--
--   kpi_series        the headline metrics bucketed by hour or by day, with
--                     empty buckets returned as zero rows so a chart does not
--                     silently skip a quiet night
--   zone_performance  one row per zone for the zone table and the mini-map
--
-- Both are plain SQL over the same tables: deterministic, no sampling.
-- ===========================================================================

drop function if exists public.kpi_series(uuid, timestamptz, timestamptz, text, text, uuid);

create or replace function public.kpi_series(
  p_company_id uuid,
  p_from       timestamptz,
  p_to         timestamptz,
  p_bucket     text default 'day',
  p_timezone   text default 'UTC',
  p_zone_id    uuid default null
)
returns table (
  bucket_start         timestamptz,
  orders_count         bigint,
  delivered_count      bigint,
  cancelled_count      bigint,
  late_count           bigint,
  revenue              numeric,
  total_cost           numeric,
  profit               numeric,
  cost_per_delivery    numeric,
  on_time_rate         numeric,
  avg_delivery_minutes numeric,
  fleet_utilization    numeric
)
language plpgsql
stable
as $fn$
declare
  v_step interval;
begin
  -- Whitelisted rather than interpolated: p_bucket reaches date_trunc, and an
  -- arbitrary string there would be both a correctness and an injection risk.
  if p_bucket not in ('hour', 'day') then
    raise exception 'kpi_series: p_bucket must be ''hour'' or ''day'', got %', p_bucket;
  end if;

  v_step := case p_bucket when 'hour' then interval '1 hour' else interval '1 day' end;

  return query
  with buckets as (
    -- Generated in the company's local time, then converted back, so a day
    -- boundary is a local midnight and a DST change does not shift the grid.
    select (gs at time zone p_timezone) as bucket_start
      from generate_series(
             date_trunc(p_bucket, p_from at time zone p_timezone),
             date_trunc(p_bucket, (p_to - interval '1 microsecond') at time zone p_timezone),
             v_step
           ) as gs
  ),
  scoped_orders as (
    select
      (date_trunc(p_bucket, o.created_at at time zone p_timezone) at time zone p_timezone)
        as bucket_start,
      o.status,
      o.promised_at,
      o.delivered_at,
      o.picked_up_at,
      o.delivery_fee
    from orders o
    where o.company_id = p_company_id
      and o.created_at >= p_from
      and o.created_at <  p_to
      and (p_zone_id is null or o.zone_id = p_zone_id)
  ),
  order_agg as (
    select
      s.bucket_start,
      count(*)::bigint                                          as orders_count,
      count(*) filter (where s.status = 'delivered')::bigint     as delivered_count,
      count(*) filter (where s.status = 'cancelled')::bigint     as cancelled_count,
      count(*) filter (
        where s.status = 'delayed'
           or (s.status = 'delivered' and s.promised_at is not null
               and s.delivered_at > s.promised_at)
      )::bigint                                                  as late_count,
      coalesce(sum(s.delivery_fee) filter (where s.status = 'delivered'), 0)::numeric as revenue,
      count(*) filter (
        where s.status = 'delivered' and s.promised_at is not null
      )::bigint                                                  as delivered_with_promise,
      count(*) filter (
        where s.status = 'delivered' and s.promised_at is not null
          and s.delivered_at <= s.promised_at
      )::bigint                                                  as on_time_count,
      avg(extract(epoch from (s.delivered_at - s.picked_up_at)) / 60.0) filter (
        where s.status = 'delivered' and s.delivered_at is not null and s.picked_up_at is not null
      )::numeric                                                 as avg_delivery_minutes
    from scoped_orders s
    group by s.bucket_start
  ),
  -- Company-wide delivered volume per bucket, used to pro-rate costs when the
  -- view is scoped to one zone. Mirrors kpi_summary's cost allocation.
  company_delivered as (
    select
      (date_trunc(p_bucket, o.created_at at time zone p_timezone) at time zone p_timezone)
        as bucket_start,
      count(*)::numeric as delivered_count
    from orders o
    where o.company_id = p_company_id
      and o.created_at >= p_from
      and o.created_at <  p_to
      and o.status = 'delivered'
    group by 1
  ),
  expense_agg as (
    select
      (date_trunc(p_bucket, e.occurred_at at time zone p_timezone) at time zone p_timezone)
        as bucket_start,
      coalesce(sum(e.amount), 0)::numeric as total_cost
    from expenses e
    where e.company_id = p_company_id
      and e.occurred_at >= p_from
      and e.occurred_at <  p_to
    group by 1
  ),
  -- Shifts are recorded per calendar day, so utilisation is only defined on a
  -- daily grid; on an hourly grid it is left null rather than invented.
  shift_agg as (
    select
      s.date                                        as day,
      coalesce(sum(s.active_minutes), 0)::numeric   as active_minutes,
      coalesce(sum(s.idle_minutes), 0)::numeric     as idle_minutes
    from driver_shifts s
    join drivers d on d.id = s.driver_id
    where s.company_id = p_company_id
      and s.date >= (p_from at time zone p_timezone)::date
      and s.date <= (p_to   at time zone p_timezone)::date
      and (p_zone_id is null or d.home_zone_id = p_zone_id)
    group by s.date
  )
  select
    b.bucket_start,
    coalesce(o.orders_count, 0)     as orders_count,
    coalesce(o.delivered_count, 0)  as delivered_count,
    coalesce(o.cancelled_count, 0)  as cancelled_count,
    coalesce(o.late_count, 0)       as late_count,
    round(coalesce(o.revenue, 0), 2) as revenue,
    cost.total_cost,
    round(coalesce(o.revenue, 0) - cost.total_cost, 2) as profit,
    round(cost.total_cost / nullif(o.delivered_count, 0), 2) as cost_per_delivery,
    round(o.on_time_count::numeric / nullif(o.delivered_with_promise, 0), 4) as on_time_rate,
    round(o.avg_delivery_minutes, 2) as avg_delivery_minutes,
    case
      when p_bucket = 'day'
        then round(sh.active_minutes / nullif(sh.active_minutes + sh.idle_minutes, 0), 4)
      else null
    end as fleet_utilization
  from buckets b
  left join order_agg o       on o.bucket_start = b.bucket_start
  left join company_delivered cd on cd.bucket_start = b.bucket_start
  left join expense_agg e     on e.bucket_start = b.bucket_start
  left join shift_agg sh      on p_bucket = 'day'
                             and sh.day = (b.bucket_start at time zone p_timezone)::date
  cross join lateral (
    select round(
      coalesce(e.total_cost, 0) * case
        when p_zone_id is null then 1.0::numeric
        when coalesce(cd.delivered_count, 0) = 0 then 0::numeric
        else coalesce(o.delivered_count, 0)::numeric / cd.delivered_count
      end,
      2
    ) as total_cost
  ) cost
  order by b.bucket_start;
end;
$fn$;

comment on function public.kpi_series(uuid, timestamptz, timestamptz, text, text, uuid) is
  'Headline KPIs bucketed by hour or day over [p_from, p_to), with empty buckets returned as zeros.';

grant execute on function public.kpi_series(uuid, timestamptz, timestamptz, text, text, uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- zone_performance
--
-- One row per zone, whether or not it saw any orders in the range. Drives the
-- zone table and the colour of each polygon on the mini-map, so it carries the
-- geometry too and the map needs no second round trip.
-- ---------------------------------------------------------------------------
drop function if exists public.zone_performance(uuid, timestamptz, timestamptz);

create or replace function public.zone_performance(
  p_company_id uuid,
  p_from       timestamptz,
  p_to         timestamptz
)
returns table (
  zone_id              uuid,
  zone_code            text,
  zone_name            text,
  center_lat           double precision,
  center_lng           double precision,
  polygon              jsonb,
  orders_count         bigint,
  delivered_count      bigint,
  late_count           bigint,
  on_time_rate         numeric,
  avg_delivery_minutes numeric,
  revenue              numeric,
  driver_count         bigint,
  orders_per_driver    numeric
)
language sql
stable
as $fn$
  with scoped_orders as (
    select o.zone_id, o.status, o.promised_at, o.delivered_at, o.picked_up_at, o.delivery_fee
      from orders o
     where o.company_id = p_company_id
       and o.created_at >= p_from
       and o.created_at <  p_to
  ),
  per_zone as (
    select
      s.zone_id,
      count(*)::bigint                                       as orders_count,
      count(*) filter (where s.status = 'delivered')::bigint  as delivered_count,
      count(*) filter (
        where s.status = 'delayed'
           or (s.status = 'delivered' and s.promised_at is not null
               and s.delivered_at > s.promised_at)
      )::bigint                                               as late_count,
      count(*) filter (
        where s.status = 'delivered' and s.promised_at is not null
      )::bigint                                               as delivered_with_promise,
      count(*) filter (
        where s.status = 'delivered' and s.promised_at is not null
          and s.delivered_at <= s.promised_at
      )::bigint                                               as on_time_count,
      avg(extract(epoch from (s.delivered_at - s.picked_up_at)) / 60.0) filter (
        where s.status = 'delivered' and s.picked_up_at is not null
      )::numeric                                              as avg_delivery_minutes,
      coalesce(sum(s.delivery_fee) filter (where s.status = 'delivered'), 0)::numeric as revenue
    from scoped_orders s
    group by s.zone_id
  ),
  per_zone_drivers as (
    select d.home_zone_id as zone_id, count(*)::bigint as driver_count
      from drivers d
     where d.company_id = p_company_id
       and d.home_zone_id is not null
     group by d.home_zone_id
  )
  select
    z.id,
    z.code,
    z.name,
    z.center_lat,
    z.center_lng,
    z.polygon,
    coalesce(p.orders_count, 0)    as orders_count,
    coalesce(p.delivered_count, 0) as delivered_count,
    coalesce(p.late_count, 0)      as late_count,
    round(p.on_time_count::numeric / nullif(p.delivered_with_promise, 0), 4) as on_time_rate,
    round(p.avg_delivery_minutes, 2) as avg_delivery_minutes,
    round(coalesce(p.revenue, 0), 2) as revenue,
    coalesce(dr.driver_count, 0)   as driver_count,
    round(coalesce(p.orders_count, 0)::numeric / nullif(dr.driver_count, 0), 1)
      as orders_per_driver
  from zones z
  left join per_zone p          on p.zone_id = z.id
  left join per_zone_drivers dr on dr.zone_id = z.id
  where z.company_id = p_company_id
  order by z.code;
$fn$;

comment on function public.zone_performance(uuid, timestamptz, timestamptz) is
  'Per-zone delivery performance and geometry over [p_from, p_to).';

grant execute on function public.zone_performance(uuid, timestamptz, timestamptz)
  to anon, authenticated;
