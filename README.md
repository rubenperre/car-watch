# car-watch

A used-car search for Liesbeth's parents (Ieper): petrol, manual with 6+ gears, Android Auto, rear camera,
under 4 years, max 50,000 km, max €20,000. A scanner reads the Belgian car sites every morning and a small
React app shows the result. **Only people on an allowlist can see the list**, and they sign in with Google.

```
GitHub Actions (daily)         Supabase (free tier)                       Browser
scanner/ -> upload.py --------> listings          <---- reads (RLS) ---- React app (GitHub Pages)
 (service_role key, secret)     allowed_emails                             Google sign-in
```

## How the data stays private

- This repo is **public** and holds code only: no listings, no email addresses, no keys.
- The data lives in Supabase. Row-level security (`supabase/migrations/0001_init.sql`) returns rows only to a user
  who is signed in **with Google** and whose email is in `allowed_emails`. Logged out, a different Google account,
  or an email sign-up: zero rows.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` end up in the JavaScript every visitor downloads. That is
  normal and safe, because the anon key can only do what the row-level security allows. **They are not secrets,
  and `.env` does not hide them.** The protection is the database rules plus the login.
- The one key that can write data, `SUPABASE_SERVICE_ROLE_KEY`, lives only in GitHub Actions secrets and in
  your own shell. Never put it in `app/` or in a `VITE_*` variable.

## One-time setup (about 20 minutes)

1. **Supabase project.** Create a free project at supabase.com. In *Project Settings, API* note the project URL,
   the `anon` key and the `service_role` key.
2. **Database.** In the Supabase SQL editor run `supabase/migrations/0001_init.sql`. Then run the insert from
   `supabase/seed.example.sql` with the real Google email addresses of Ruben (admin), Liesbeth and the parents.
3. **Turn off other sign-in methods.** *Authentication, Providers*: disable Email. Only Google stays on.
4. **Google sign-in.**
   - Google Cloud Console: create a project, *APIs & Services, OAuth consent screen* (External), set the publishing
     status to **In production** (basic email/profile scopes need no verification; in "Testing" only listed test
     users could sign in).
   - *Credentials, Create OAuth client ID, Web application*. Authorised redirect URI:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   - Paste the client ID and secret into Supabase, *Authentication, Providers, Google*, and enable it.
5. **Redirect URLs.** Supabase, *Authentication, URL Configuration*: Site URL `https://rubenperre.github.io/car-watch/`,
   plus the redirect URLs `https://rubenperre.github.io/car-watch/` and `http://localhost:5173/`.
6. **GitHub.** In the repo settings: *Pages, Source: GitHub Actions*. Add repository **variables**
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and repository **secrets** `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (or `gh secret set` / `gh variable set`).
7. Run the *Refresh listings* workflow once by hand, then open the site and sign in.

## Daily use

- The workflow *Refresh listings* runs every morning (about 07:00 Belgian time): scan, merge, upload. New cars get
  `status = new`, cars that vanished for 3 runs get `gone`.
- Give someone access: sign in as an admin, open the **Toegang** tab, add their Google email. Revoke the same way.
- The scan uses plain HTTPS requests to AutoScout24.be, Autohero and Cardoen.be and costs nothing. If a site blocks
  GitHub's servers the run fails visibly; then run `bash scanner/run.sh` from your own machine instead.

## Develop

```bash
cd app
cp .env.example .env      # fill in the two public values
npm install
npm run dev               # http://localhost:5173/
npm run build             # type-check + production build, the same check CI runs
```

Scanner (Python 3, standard library only):

```bash
bash scanner/run.sh --dry-run   # scan and show what would be uploaded, changes nothing
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bash scanner/run.sh
```

The search criteria live in `scanner/common.py` (km, price, registration cut-off, which moves forward one month
each month) and in `scanner/merge.py` (gears, PureTech ranking, Android Auto and camera checks).

## Check that it is locked

With only the public anon key and no login, both calls must return `[]`:

```bash
curl -s "$SUPABASE_URL/rest/v1/listings"       -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
curl -s "$SUPABASE_URL/rest/v1/allowed_emails" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Then sign in with a Google account that is **not** on the list: the app must say "Geen toegang".
