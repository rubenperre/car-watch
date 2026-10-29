-- car-watch: tables, row-level security and access helpers.
-- Run once in the Supabase SQL editor. Re-running is safe where "if not exists" / "or replace" is used.
--
-- Access model: a person gets data only when they are signed in with GOOGLE and their email is in
-- allowed_emails. Everyone else (logged out, other Google accounts, email sign-ups) gets zero rows.
-- Only the scanner writes listings, using the service_role key (it bypasses RLS).

create table if not exists public.allowed_emails (
  email    text primary key check (email = lower(email)),
  role     text not null default 'viewer' check (role in ('admin', 'viewer')),
  added_at timestamptz not null default now()
);

create table if not exists public.listings (
  id                 text primary key,            -- posting id on the source site
  source             text not null,
  make               text,
  model              text,
  title              text not null,
  price              integer not null,
  first_registration text,                        -- YYYY-MM
  km                 integer not null,
  gears              integer,
  seller             text,
  phone              text,
  town               text,
  zip                text,
  distance_km        integer,                     -- estimate, road km from Ieper
  android_auto       text not null default 'missing' check (android_auto in ('confirmed', 'missing')),
  camera             text not null default 'missing' check (camera in ('confirmed', 'missing')),
  evidence           text,                        -- the equipment lines that show Android Auto / camera
  url                text not null,
  match              text not null default 'partial' check (match in ('full', 'partial')),
  bigger             boolean not null default false,
  owners             integer,
  no_accident        boolean not null default false,
  service_history    boolean not null default false,
  private_seller     boolean not null default false,
  is_new             boolean not null default false,  -- new or demo car (almost no km)
  first_seen         date not null default current_date,
  last_seen          date not null default current_date,
  missing_runs       integer not null default 0,
  status             text not null default 'active' check (status in ('new', 'active', 'gone'))
);

alter table public.allowed_emails enable row level security;
alter table public.listings enable row level security;

-- Who is the caller? Null unless signed in with Google and on the allowlist.
-- security definer: reads allowed_emails regardless of the caller's own policies.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.allowed_emails a
  where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
$$;

create or replace function public.is_allowed() returns boolean
language sql stable security definer set search_path = public
as $$ select public.my_role() is not null $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select public.my_role() = 'admin' $$;

-- Defence in depth: the anonymous role gets nothing at all, even before RLS applies.
revoke all on public.listings from anon;
revoke all on public.allowed_emails from anon;
revoke execute on function public.my_role(), public.is_allowed(), public.is_admin() from public, anon;
grant execute on function public.my_role(), public.is_allowed(), public.is_admin() to authenticated;

-- Logged-in users can only read; the scanner writes with service_role.
revoke insert, update, delete, truncate on public.listings from authenticated;
grant select on public.listings to authenticated;
grant select, insert, update, delete on public.allowed_emails to authenticated;

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings
  for select to authenticated
  using (public.is_allowed());

-- Admins manage the allowlist from the app. Viewers never read this table (they call my_role()).
drop policy if exists allowed_select on public.allowed_emails;
create policy allowed_select on public.allowed_emails
  for select to authenticated using (public.is_admin());

drop policy if exists allowed_insert on public.allowed_emails;
create policy allowed_insert on public.allowed_emails
  for insert to authenticated with check (public.is_admin());

drop policy if exists allowed_update on public.allowed_emails;
create policy allowed_update on public.allowed_emails
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists allowed_delete on public.allowed_emails;
create policy allowed_delete on public.allowed_emails
  for delete to authenticated using (public.is_admin());

create index if not exists listings_status_idx on public.listings (status);
