-- ===========================================================================
-- NEXUS - Migration 0000: Supabase-compatible roles
--
-- Supabase ships the `anon` and `authenticated` roles with every project, and
-- the RLS policies and grants in later migrations name them directly. A plain
-- Postgres (local development, CI, a self-hosted deployment) has neither, so
-- the later migrations would fail there.
--
-- Creating them here keeps one set of migrations working against both. On
-- Supabase the roles already exist and every statement below is a no-op.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
