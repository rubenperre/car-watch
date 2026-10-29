-- Access requests: who signed in with Google but is not on the allowlist, and an instant phone push for it.
-- Applied by .github/workflows/migrate.yml.

-- pg_net lets the database make an HTTP call (used for the push below). The call is queued and sent
-- in the background, so it never slows down a sign-in.
create extension if not exists pg_net with schema extensions;

-- Settings that must not be public. For now only the ntfy topic, which works as a password: anyone who knows
-- it can read the notifications. The table is locked: row-level security on, no policies, nothing granted to
-- anon or authenticated. Only service_role (the Sync settings workflow) and the trigger below can read it.
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select, insert, update on public.app_settings to service_role;

-- The list shown in the app's Toegang tab. security definer, because ordinary users cannot read auth.users.
-- The admin check is inside the function, so anyone who is not an admin gets zero rows.
create or replace function public.access_requests()
returns table (email text, requested_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email::text, u.created_at, u.last_sign_in_at
  from auth.users u
  where public.is_admin()
    and u.email is not null
    and not exists (select 1 from public.allowed_emails a where a.email = lower(u.email))
  order by u.created_at desc
$$;

revoke execute on function public.access_requests() from public, anon;
grant execute on function public.access_requests() to authenticated;

-- A new account that is not on the allowlist: push the address to the phone through ntfy.sh.
-- This fires once, the first time an address ever signs in. Later attempts by the same address only show up in the list.
create or replace function public.notify_access_request()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  topic text;
begin
  select s.value into topic from public.app_settings s where s.key = 'ntfy_topic';
  if topic is null or new.email is null then
    return new;
  end if;
  if exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ntfy.sh',
    body := jsonb_build_object(
      'topic', topic,
      'title', 'Toegangsaanvraag Autozoeker',
      'message', new.email || ' wil de lijst zien. Open de Toegang-tab om toegang te geven.',
      'priority', 4,
      'tags', jsonb_build_array('key')
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
exception when others then
  -- A failing push must never block a sign-in.
  return new;
end;
$$;

revoke execute on function public.notify_access_request() from public, anon, authenticated;

drop trigger if exists notify_access_request on auth.users;
create trigger notify_access_request
  after insert on auth.users
  for each row execute function public.notify_access_request();
