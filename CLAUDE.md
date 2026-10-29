# CLAUDE.md (car-watch)

Own-repo project of the Claude-sandbox hub, cloned at `projects/car-watch/`. Git commands run inside this
folder; follow the hub's commit rules (Conventional Commits, no Claude attribution, PR against `main`).

- **Public repo.** Never commit data, email addresses, `.env` files or keys. `.env.example` holds placeholders only.
- **Keys.** The anon key and project URL are public by design (`VITE_*`). `SUPABASE_SERVICE_ROLE_KEY` is only
  used by `scanner/upload.py` through the environment or Actions secrets, never in `app/`.
- **Security model.** Row-level security in `supabase/migrations/0001_init.sql` is the access control. Any change to
  tables or policies is a new numbered migration, and must keep: logged-out and non-allowlisted users get zero rows.
  Re-run the two `curl` checks in the README after every policy change.
- **App.** Vite + React + TypeScript in `app/`, Dutch UI. `npm run build` must pass before a PR.
- **Scanner.** Python standard library only, plain HTTPS, free. Android Auto and camera count only when the posting
  itself says so. A failed or empty scan must not mark cars as gone (`upload.py` aborts on an empty result).
- **Criteria changes** (budget, km, region): `scanner/common.py`, `scanner/merge.py`, the header text in
  `app/src/components/CarList.tsx`, and the README, together.
