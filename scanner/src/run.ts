// Entry point: scan the sites, rank the cars, upload them to Supabase.
//   npm run scan        scan + upload (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
//   npm run scan:dry    scan only, write scanner/out/ranked.json, change nothing
import { mkdir, writeFile } from "node:fs/promises";
import { evaluate } from "./rank.ts";
import { ID_PREFIX, toRows } from "./rows.ts";
import { scanAutohero } from "./sources/autohero.ts";
import { scanAutoScout24 } from "./sources/autoscout24.ts";
import { scanCardoen } from "./sources/cardoen.ts";
import type { Car, Source } from "./types.ts";
import { upload } from "./upload.ts";

const dry = process.argv.includes("--dry-run");
const log = (m: string) => console.error(m);
const today = new Date();

const scanners: [Source, (log: (m: string) => void, today: Date) => Promise<Car[]>][] = [
  ["AutoScout24.be", scanAutoScout24],
  ["Autohero", scanAutohero],
  ["Cardoen.be", scanCardoen],
];

// The sites are different hosts, so scan them side by side. One failing must not stop the others.
const results = await Promise.allSettled(scanners.map(([, scan]) => scan(log, today)));
const cars: Car[] = [];
const failed: Source[] = [];
results.forEach((res, i) => {
  const name = (scanners[i] as (typeof scanners)[number])[0];
  if (res.status === "fulfilled") cars.push(...res.value);
  else {
    failed.push(name);
    log(`FAILED ${name}: ${(res.reason as Error).message}`);
  }
});

const ranked = evaluate(cars, today);
const rows = toRows(ranked);
log(`${cars.length} cars read, ${ranked.length} pass the criteria, ${rows.length} qualify for the list`);
if (rows.length === 0) {
  log("Nothing qualifies: a site probably blocked us. The database was not touched.");
  process.exit(1);
}

if (dry) {
  await mkdir(new URL("../out/", import.meta.url), { recursive: true });
  await writeFile(new URL("../out/ranked.json", import.meta.url), JSON.stringify(rows, null, 2));
  log("dry run: wrote scanner/out/ranked.json");
} else {
  const result = await upload(rows, { skipMissingForPrefixes: failed.map((s) => ID_PREFIX[s]) });
  log(`uploaded: ${result.added} new, ${result.seen} seen again, ${result.gone} marked gone`);
}
// A site that failed still lets the others upload, but the run ends red so the failure is noticed.
if (failed.length > 0) process.exitCode = 1;
