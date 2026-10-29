-- The scanner writes with the secret key (role service_role). That role bypasses row-level security,
-- but it still needs table privileges, and newer Supabase projects do not grant them automatically
-- to tables created in the SQL editor ("permission denied for table listings").
-- Run once in the Supabase SQL editor, after 0001.

grant usage on schema public to service_role;
grant select, insert, update, delete on public.listings to service_role;
grant select on public.allowed_emails to service_role;

-- The signed-in app also needs to see the schema (policies still decide which rows it gets).
grant usage on schema public to authenticated;

-- To check what each role may do:
--   select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' order by table_name, grantee, privilege_type;
