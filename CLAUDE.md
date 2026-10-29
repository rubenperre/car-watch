# CLAUDE.md (car-watch)

Own-repo project of the Claude-sandbox hub, cloned at `projects/car-watch/`. Git commands run inside this
folder; follow the hub's commit rules (Conventional Commits, no Claude attribution, PR against `main`).

- **Language.** Everything is TypeScript (Ruben knows it): `app/` is Vite + React, `scanner/` runs on Node 24
  with native type stripping (imports end in `.ts`, no enums or namespaces). No Python.
- **Public repo.** Never commit data, email addresses, `.env` files or keys. `.env.example` holds placeholders only.
- **Keys.** The anon key and project URL are public by design (`VITE_*`). `SUPABASE_SERVICE_ROLE_KEY` is only
  used by `scanner/src/upload.ts` through the environment or Actions secrets, never in `app/`.
- **Security model.** Row-level security in `supabase/migrations/0001_init.sql` is the access control. Any change to
  tables or policies is a new numbered migration, and must keep: logged-out and non-allowlisted users get zero rows.
  Re-run the two `curl` checks in the README after every policy change.
- **Checks before a PR.** `npm run build` in `app/`, `npm run typecheck` and `npm test` in `scanner/`. CI runs the same.
  New scanner behaviour gets a unit test in `scanner/test/` (use small inline HTML/JSON fixtures, no network).
- **Scanner.** Plain HTTPS, free, no scraping services. Android Auto and camera count only when the posting itself
  says so. A failed or empty scan must not mark cars as gone (`run.ts` aborts on an empty result, `upload.ts`
  skips sites that failed).
- **Criteria changes** (budget, km, region): `scanner/src/criteria.ts`, `scanner/src/rank.ts`, the header text in
  `app/src/components/CarList.tsx`, and the README, together.
