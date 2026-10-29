-- The admins workflow (scanner/src/sync-admins.ts) adds the first admin with the secret key (service_role).
-- 0002 only let that role read allowed_emails; it now also needs to insert and update.
-- This file is applied by .github/workflows/migrate.yml, nobody has to paste it into the SQL editor.

grant insert, update on public.allowed_emails to service_role;
