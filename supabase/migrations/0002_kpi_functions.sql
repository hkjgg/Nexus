-- ===========================================================================
-- NEXUS - Migration 0002: deterministic KPI layer
--
-- A single set-returning function computes all ten headline KPIs for a
-- company, a half-open time range [p_from, p_to) and an optional zone.
-- Everything here is plain SQL: given the same rows and the same arguments
-- the output is always identical. No AI, no sampling, no randomness.
--
-- Metric definitions (documented so the UI and the AI layer agree):
--   orders_count            orders created in range
--   revenue                 sum(delivery_fee) over DELIVERED orders
--   delivered_count         orders in range with status 'delivered'
--   success_rate            delivered / (delivered + failed + cancelled)
--   on_time_rate            delivered with delivered_at <= promised_at
--                             / delivered with a promised_at
--   avg_delivery_minutes    avg(delivered_at - picked_up_at) over delivered
--   fleet_utilization       sum(active_minutes) / sum(active + idle minutes)
--   total_cost              sum(expenses.amount) in range
--   cost_per_delivery       total_cost / delivered
--   profit                  revenue - total_cost
--   delay_rate              late orders / orders_count, where "late" means
--                             status 'delayed', or delivered after promised_at
--   cancellation_rate       cancelled / orders_count
--
-- Zone scoping: order- and shift-derived metrics filter directly. Expenses
-- are not zone-attributed at source (fuel belongs to a vehicle, overhead to
-- the company), so when a zone is supplied the cost figures are allocated
-- pro-rata by that zone's share of delivered orders in the same range. This
-- keeps cost_per_delivery and profit meaningful per zone while remaining
-- fully deterministic.
-- ===========================================================================

drop function if exists public.kpi_summary(uuid, timestamptz, timestamptz, uuid);

create or replace function public.kpi_summary(
  p_company_id uuid,
  p_from       timestamptz,
  p_to         timestamptz,
  p_zone_id    uuid default null
)
returns table (
  orders_count         bigint,
  delivered_count      bigint,
  cancelled_count      bigint,
  failed_count         bigint,
  late_count           bigint,
  revenue              numeric,
  total_cost           numeric,
  profit               numeric,
  cost_per_delivery    numeric,
  success_rate         numeric,
  on_time_rate         numeric,
  delay_rate           numeric,
  cancellation_rate    numeric,
  avg_delivery_minutes numeric,
  fleet_utilization    numeric
)
language sql
stable
as $$
  with scoped_orders as (
    select *
      from orders o
     where o.company_id = p_company_id
       and o.created_at >= p_from
       and o.created_at <  p_to
       and (p_zone_id is null or o.zone_id = p_zone_id)
  ),
  order_agg as (
    select
      count(*)::bigint as orders_count,
      count(*) filter (where status = 'delivered')::bigint as delivered_count,
      count(*) filter (where status = 'cancelled')::bigint as cancelled_count,
      count(*) filter (where status = 'failed')::bigint    as failed_count,
      count(*) filter (
        where status = 'delayed'
           or (status = 'delivered' and promised_at is not null and delivered_at > promised_at)
      )::bigint as late_count,
      coalesce(sum(delivery_fee) filter (where status = 'delivered'), 0)::numeric as revenue,
      count(*) filter (
        where status = 'delivered' and promised_at is not null
      )::bigint as delivered_with_promise,
      count(*) filter (
        where status = 'delivered' and promised_at is not null and delivered_at <= promised_at
      )::bigint as on_time_count,
      avg(
        extract(epoch from (delivered_at - picked_up_at)) / 60.0
      ) filter (
        where status = 'delivered' and delivered_at is not null and picked_up_at is not null
      )::numeric as avg_delivery_minutes
    from scoped_orders
  ),
  -- Share of company-wide delivered volume attributable to the scoped zone.
  -- 1.0 when no zone filter is applied.
  company_delivered as (
    select count(*)::numeric as n
      from orders o
     where o.company_id = p_company_id
       and o.created_at >= p_from
       and o.created_at <  p_to
       and o.status = 'delivered'
  ),
  cost_share as (
    select case
             when p_zone_id is null then 1.0::numeric
             when (select n from company_delivered) = 0 then 0::numeric
             else (select delivered_count from order_agg)::numeric
                  / (select n from company_delivered)
           end as share
  ),
  expense_agg as (
    select coalesce(sum(e.amount), 0)::numeric as total_cost
      from expenses e
     where e.company_id = p_company_id
       and e.occurred_at >= p_from
       and e.occurred_at <  p_to
  ),
  shift_agg as (
    select
      coalesce(sum(s.active_minutes), 0)::numeric as active_minutes,
      coalesce(sum(s.idle_minutes), 0)::numeric   as idle_minutes
      from driver_shifts s
      join drivers d on d.id = s.driver_id
     where s.company_id = p_company_id
       and s.date >= (p_from at time zone 'UTC')::date
       and s.date <  (p_to   at time zone 'UTC')::date
       and (p_zone_id is null or d.home_zone_id = p_zone_id)
  ),
  scoped_cost as (
    select round((select total_cost from expense_agg) * (select share from cost_share), 2) as total_cost
  )
  select
    o.orders_count,
    o.delivered_count,
    o.cancelled_count,
    o.failed_count,
    o.late_count,
    round(o.revenue, 2)                                          as revenue,
    c.total_cost,
    round(o.revenue - c.total_cost, 2)                           as profit,
    round(c.total_cost / nullif(o.delivered_count, 0), 2)        as cost_per_delivery,
    round(
      o.delivered_count::numeric
        / nullif(o.delivered_count + o.cancelled_count + o.failed_count, 0),
      4
    )                                                            as success_rate,
    round(o.on_time_count::numeric / nullif(o.delivered_with_promise, 0), 4) as on_time_rate,
    round(o.late_count::numeric      / nullif(o.orders_count, 0), 4)         as delay_rate,
    round(o.cancelled_count::numeric / nullif(o.orders_count, 0), 4)         as cancellation_rate,
    round(o.avg_delivery_minutes, 2)                             as avg_delivery_minutes,
    round(
      s.active_minutes / nullif(s.active_minutes + s.idle_minutes, 0),
      4
    )                                                            as fleet_utilization
  from order_agg o
  cross join scoped_cost c
  cross join shift_agg s;
$$;

comment on function public.kpi_summary(uuid, timestamptz, timestamptz, uuid) is
  'Deterministic headline KPIs for a company over [p_from, p_to), optionally scoped to one zone.';

grant execute on function public.kpi_summary(uuid, timestamptz, timestamptz, uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Convenience view: one row per zone per day, used by trend charts and by the
-- AI layer when it looks for zone-level anomalies.
-- ---------------------------------------------------------------------------
-- security_invoker makes the view respect the querying role's RLS policies.
-- Without it a view runs with its owner's privileges and would leak non-demo
-- tenants to anonymous visitors.
create or replace view public.v_zone_daily
  with (security_invoker = true) as
select
  o.company_id,
  o.zone_id,
  z.code                                          as zone_code,
  (o.created_at at time zone 'UTC')::date         as day,
  count(*)::bigint                                as orders_count,
  count(*) filter (where o.status = 'delivered')::bigint as delivered_count,
  count(*) filter (
    where o.status = 'delayed'
       or (o.status = 'delivered' and o.promised_at is not null and o.delivered_at > o.promised_at)
  )::bigint                                       as late_count,
  coalesce(sum(o.delivery_fee) filter (where o.status = 'delivered'), 0)::numeric as revenue,
  avg(
    extract(epoch from (o.delivered_at - o.picked_up_at)) / 60.0
  ) filter (where o.status = 'delivered' and o.picked_up_at is not null)::numeric
                                                  as avg_delivery_minutes
from orders o
join zones z on z.id = o.zone_id
group by o.company_id, o.zone_id, z.code, (o.created_at at time zone 'UTC')::date;

grant select on public.v_zone_daily to anon, authenticated;
