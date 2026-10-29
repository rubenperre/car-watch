# car-watch

A used-car search for Liesbeth's parents (Ieper): petrol, manual with 6+ gears, Android Auto, rear camera,
under 4 years, max 50,000 km, max €20,000. A TypeScript scanner reads the Belgian car sites every morning and a
small React app shows the result. **Only people on an allowlist can see the list**, and they sign in with Google.

```
GitHub Actions (daily)         Supabase (free tier)                       Browser
scanner/ (TypeScript) -------> listings          <---- reads (RLS) ---- React app (GitHub Pages)
 (service_role key, secret)     allowed_emails                             Google sign-in
```

Everything is TypeScript: `app/` (Vite + React) and `scanner/` (Node 24, no build step). The database rules are
plain SQL in `supabase/`.

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
6. **GitHub.** Add repository **variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and repository
   **secrets** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Settings, Secrets and variables, Actions; or
   `gh variable set` / `gh secret set`). Pages is already set to deploy from GitHub Actions.
7. Run the *Refresh listings* workflow once by hand, then open the site and sign in.

## Daily use

- *Refresh listings* runs every morning (about 07:00 Belgian time): scan, rank, upload. New cars get
  `status = new`, cars that vanished for 3 runs in a row get `gone`.
- Give someone access: sign in as an admin, open the **Toegang** tab, add their Google email. Revoke the same way.
- The scan uses plain HTTPS requests to AutoScout24.be, Autohero and Cardoen.be and costs nothing. A site that
  fails is skipped (its cars are not counted as missing) and the run ends red so you notice.

## Develop

```bash
# app (React)
cd app
cp .env.example .env      # fill in the two public values
npm install
npm run dev               # http://localhost:5173/
npm run build             # type-check + production build, the same check CI runs

# scanner (Node 24 runs the TypeScript directly, no build step)
cd scanner
npm install
npm test                  # unit tests (Vitest)
npm run typecheck
npm run scan:dry          # scan the live sites, write scanner/out/ranked.json, change nothing
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run scan   # scan and upload
```

Where things live in `scanner/src/`:

| File | What it does |
|---|---|
| `criteria.ts` | The search criteria: km, price, registration cut-off (moves forward one month each month), Flanders |
| `sources/*.ts` | One scanner per site. Each opens every posting and returns `Car` objects |
| `signals.ts` | Reads Android Auto, camera and gear count out of posting text |
| `rank.ts` | Applies the hard criteria, flags the soft ones, sorts best first |
| `rows.ts` | Turns ranked cars into database rows (which cars are uploaded) |
| `upload.ts` | Writes the rows to Supabase with `supabase-js` and the service_role key |
| `run.ts` | Entry point: scan all sites side by side, rank, upload |

Criteria changes: `scanner/src/criteria.ts`, `scanner/src/rank.ts`, the header text in
`app/src/components/CarList.tsx`, and this README, together.

## The pipelines (GitHub Actions)

Workflows live in `.github/workflows/`. A workflow is a YAML file that says *when* to run (`on:`), and *what* to
run, as `jobs` made of `steps`. Each job gets a fresh virtual machine.

**`ci.yml`: CI/CD for the app.**
- *Triggers:* every pull request, every push to `main`, and a manual button.
- *Jobs:* `scanner` (type-check and unit tests) and `app` (type-check and production build) run **in parallel**.
  `deploy` has `needs: [scanner, app]`, so it only starts when both are green, and only on `main`.
- *CI vs CD:* CI is the checks on every change. CD is `deploy`, which publishes the built site to GitHub Pages.
- *Artifact:* the `app` job uploads `app/dist` as an artifact, the `deploy` job downloads it and publishes it. The
  site that goes live is exactly the one that was tested.
- *`concurrency`:* a newer push cancels the older checks of the same branch. The deploy job is the exception, it
  is never cancelled halfway.
- *`permissions`:* the default is read-only. `deploy` alone gets `pages: write` and `id-token: write`.
- *Caching:* `setup-node` with `cache: npm` reuses downloaded packages between runs.
- *Environment:* `github-pages` is the deployment target. GitHub only lets the branches listed on that environment
  deploy to it (Settings, Environments).

**`refresh.yml`: a scheduled job.**
- *Trigger:* `schedule` with a cron expression (`30 5 * * *` is 05:30 UTC every day), plus a manual button.
- *Secrets vs variables:* `SUPABASE_SERVICE_ROLE_KEY` is a **secret** (masked in logs, never shown again after you
  set it). The `VITE_*` values are **variables**, because they are public anyway.
- *`keepalive` job:* GitHub switches off scheduled workflows in a public repo after 60 days without a commit. Once
  a month this job adds an empty commit on its own branch to prevent that.

**`dependabot.yml`:** opens weekly pull requests for outdated packages and actions. Each one runs `ci.yml`, so a
breaking update shows up red before you merge it.

Useful commands: `gh run list`, `gh run view <id> --log-failed`, `gh run rerun <id> --failed`, `gh workflow run refresh.yml`.

## Check that it is locked

With only the public anon key and no login, both calls must return `[]`:

```bash
curl -s "$SUPABASE_URL/rest/v1/listings"       -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
curl -s "$SUPABASE_URL/rest/v1/allowed_emails" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Then sign in with a Google account that is **not** on the list: the app must say "Geen toegang".
