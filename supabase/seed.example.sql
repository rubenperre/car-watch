-- Template. Copy the lines you need into the Supabase SQL editor with the REAL email addresses.
-- Never commit real addresses to this public repo. Emails must be lower case and must be the
-- Google account each person signs in with.
insert into public.allowed_emails (email, role) values
  ('ruben@example.com',     'admin'),
  ('liesbeth@example.com',  'viewer'),
  ('mama@example.com',      'viewer'),
  ('papa@example.com',      'viewer')
on conflict (email) do update set role = excluded.role;
