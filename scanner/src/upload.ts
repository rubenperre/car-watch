import { createClient } from "@supabase/supabase-js";
import { GONE_AFTER_RUNS } from "./criteria.ts";
import type { ListingRow } from "./types.ts";

// Uses the service_role key, which bypasses row-level security. It comes from the environment
// (GitHub Actions secret, or your own shell) and must never end up in app/ or a VITE_* variable.
export async function upload(
  rows: ListingRow[],
  opts: { skipMissingForPrefixes: string[]; today?: string },
): Promise<{ added: number; seen: number; gone: number }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await db.from("listings").select("id,status,missing_runs").range(0, 4999);
  if (error) throw new Error(`reading listings failed: ${error.message}`);
  const existing = new Map((data ?? []).map((r) => [r.id as string, r]));

  // New cars get first_seen; cars we already know keep theirs because the upsert does not send it.
  const fresh = rows
    .filter((r) => !existing.has(r.id))
    .map((r) => ({ ...r, first_seen: today, last_seen: today, missing_runs: 0, status: "new" }));
  const known = rows
    .filter((r) => existing.has(r.id))
    .map((r) => ({ ...r, last_seen: today, missing_runs: 0, status: "active" }));
  for (const batch of [fresh, known]) {
    if (batch.length === 0) continue;
    const res = await db.from("listings").upsert(batch, { onConflict: "id" });
    if (res.error) throw new Error(`upsert failed: ${res.error.message}`);
  }

  // Cars that were not in this scan: count the miss, and mark them gone after a few in a row.
  // A site that failed to scan is skipped, so an outage never makes its cars disappear.
  const seen = new Set(rows.map((r) => r.id));
  let gone = 0;
  for (const [id, old] of existing) {
    if (seen.has(id) || old.status === "gone") continue;
    if (opts.skipMissingForPrefixes.some((p) => id.startsWith(`${p}-`))) continue;
    const misses = ((old.missing_runs as number | null) ?? 0) + 1;
    const isGone = misses >= GONE_AFTER_RUNS;
    gone += isGone ? 1 : 0;
    const res = await db.from("listings").update({ missing_runs: misses, ...(isGone ? { status: "gone" } : {}) }).eq("id", id);
    if (res.error) throw new Error(`update ${id} failed: ${res.error.message}`);
  }
  return { added: fresh.length, seen: known.length, gone };
}
