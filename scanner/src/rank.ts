import { MAX_KM, MAX_PRICE, minReg } from "./criteria.ts";
import type { Car, Ranked } from "./types.ts";

// Models that are a bigger crossover, closer to the Karoq the parents like.
const BIG = new Set([
  "karoq", "ateca", "kodiaq", "tiguan", "sportage", "tucson", "kuga", "cx-5", "duster", "qashqai", "grandland",
  "grandland x", "3008", "vitara", "s-cross", "t-roc", "xceed", "kona", "puma", "cx-30", "tivoli", "renegade",
  "500x", "juke", "arkana",
]);
const PURETECH_ENGINE = /puretech|1\.2 turbo|1\.2t|ecotec/i;
const PURETECH_MAKES = new Set(["Citroen", "Peugeot", "Opel", "DS"]);
// The data says manual but the title says automatic: leave the car out instead of guessing.
const AUTOMATIC_TITLE = /automaat|\baut\.|\bdsg\b|\bedc\b|\bcvt\b|\beat\d|\bdct\b|s-tronic|tiptronic|automatic|\bat\b|\bdkg\b/i;
const VW_GROUP = new Set(["Skoda", "SEAT", "Volkswagen"]);

/** Gears: what the posting states; a 70 kW VW-group 1.0 TSI is known to be a 5-speed. */
function effectiveGears(car: Car): number | null {
  if (car.gears !== null) return car.gears;
  return VW_GROUP.has(car.make) && car.powerKw !== null && car.powerKw <= 70 ? 5 : null;
}

function score(r: Omit<Ranked, "score">): number {
  let s = r.ok ? 40 : r.aaOk || r.camera ? 15 : 0;
  s += r.gearsOk ? 10 : 0;
  s += r.big ? 8 : 0;
  s -= r.pt ? 12 : 0;
  s += (r.powerKw ?? 0) >= 85 ? 6 : 0;
  s += Math.max(0, 12 - (r.distanceKm ?? 120) / 10);
  s += Math.max(0, (MAX_KM - r.km) / 5000);
  s += Math.max(0, (MAX_PRICE - r.price) / 1500);
  return s;
}

/** Apply the hard criteria, flag the soft ones, and sort best first. */
export function evaluate(cars: Car[], today: Date = new Date()): Ranked[] {
  const out: Ranked[] = [];
  for (const car of cars) {
    if (car.reg < minReg(today) || car.km > MAX_KM || car.price > MAX_PRICE) continue;
    if (AUTOMATIC_TITLE.test(car.version)) continue;
    const gearsEff = effectiveGears(car);
    if (gearsEff !== null && gearsEff < 6) continue;
    const aaOk = car.aaExplicit || car.aaInferred;
    const partial = {
      ...car,
      gearsEff,
      gearsOk: gearsEff !== null && gearsEff >= 6,
      pt: PURETECH_ENGINE.test(car.version) || PURETECH_MAKES.has(car.make),
      big: BIG.has(car.model.toLowerCase()),
      aaOk,
      ok: aaOk && car.camera,
    };
    out.push({ ...partial, score: score(partial) });
  }
  return out.sort((a, b) => b.score - a.score);
}
