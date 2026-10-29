import { NEAR_KM } from "./criteria.ts";
import type { ListingRow, Ranked, Source } from "./types.ts";

/** Row ids start with a short source tag, so ids from different sites can never collide. */
export const ID_PREFIX: Record<Source, string> = { "AutoScout24.be": "as24", Autohero: "ah", "Cardoen.be": "cd" };

/** The equipment lines (or description snippets) that show Android Auto / camera, as proof for the reader. */
export function evidence(car: Ranked): string | null {
  const lines = car.equipment.filter((e) => /android|camera|caméra/i.test(e));
  if (lines.length === 0) {
    for (const m of car.description.matchAll(/android\s*auto|camera|caméra/gi)) {
      lines.push(car.description.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).trim());
      if (lines.length >= 2) break;
    }
  }
  return [...new Set(lines)].join("; ").slice(0, 160) || null;
}

const near = (c: Ranked) => c.source !== "AutoScout24.be" || (c.distanceKm !== null && c.distanceKm <= NEAR_KM);

/** Which cars go to the database, and how they look there. */
export function toRows(ranked: Ranked[]): ListingRow[] {
  return ranked
    .filter((c) => c.gearsOk && !c.pt && near(c) && (c.aaOk || c.camera))
    .map((c) => ({
      id: `${ID_PREFIX[c.source]}-${c.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60)}`,
      source: c.source,
      make: c.make,
      model: c.model,
      title: `${c.make} ${c.model} ${c.version}`.replace(/\s+/g, " ").trim().slice(0, 90),
      price: c.price,
      first_registration: c.reg,
      km: c.km,
      gears: c.gearsEff,
      seller: c.seller ?? (c.privateSeller ? "Particulier" : null),
      phone: c.phone,
      town: c.town,
      zip: c.zip,
      distance_km: c.distanceKm,
      android_auto: c.aaOk ? "confirmed" : "missing",
      camera: c.camera ? "confirmed" : "missing",
      evidence: evidence(c),
      url: c.url,
      match: c.ok ? "full" : "partial",
      bigger: c.big,
      owners: c.owners,
      no_accident: c.accident === false,
      service_history: c.serviceHistory === true,
      private_seller: c.privateSeller,
      is_new: c.km < 500,
    }));
}
