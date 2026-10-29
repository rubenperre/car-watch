import { IEPER, isFlanders, MAX_KM, MAX_PRICE, minReg, minRegYear } from "../criteria.ts";
import { getText, nextData, sleep, type Obj } from "../http.ts";
import { aaExplicit, aaInferred, gearsFromText, hasCamera } from "../signals.ts";
import { haversineKm, roadKm, stripHtml } from "../text.ts";
import type { Car } from "../types.ts";

const BASE = "https://www.autoscout24.be";

// Crossover models worth a look. The search pages are per model because AutoScout24 pads a model's results
// with "similar" cars, and the body type is only known on the posting itself.
export const MODELS = [
  "skoda/karoq", "skoda/kamiq", "skoda/kodiaq", "seat/ateca", "seat/arona", "cupra/ateca",
  "volkswagen/t-roc", "volkswagen/t-cross", "volkswagen/tiguan", "kia/xceed", "kia/sportage", "kia/stonic",
  "hyundai/kona", "hyundai/bayon", "hyundai/tucson", "suzuki/s-cross", "suzuki/vitara", "ford/puma",
  "ford/kuga", "mazda/cx-30", "mazda/cx-5", "mazda/cx-3", "opel/mokka", "opel/grandland", "peugeot/2008",
  "peugeot/3008", "renault/captur", "renault/arkana", "nissan/juke", "nissan/qashqai", "dacia/duster",
  "toyota/c-hr", "toyota/yaris-cross", "honda/hr-v", "mitsubishi/asx", "citroen/c3-aircross",
  "citroen/c5-aircross", "jeep/renegade", "fiat/500x", "audi/q2", "bmw/x1", "mini/countryman", "volvo/xc40",
];

const searchUrl = (model: string, page: number, today: Date) =>
  `${BASE}/nl/lst/${model}?atype=C&cy=B&fregfrom=${minRegYear(today)}&gear=M&fuel=B&kmto=${MAX_KM}` +
  `&priceto=${MAX_PRICE}&sort=age&desc=1&page=${page}`;

interface Stub {
  id: string;
  url: string;
  make: string;
  model: string;
  version: string;
  reg: string;
  km: number;
  price: number;
  zip: string;
  town: string;
  seller: string | null;
  privateSeller: boolean;
  phone: string | null;
}

/** Cars on a results page that fit the hard criteria. Exported for tests. */
export function stubsFromResults(listings: Obj[], today: Date): Stub[] {
  const out: Stub[] = [];
  for (const l of listings) {
    const tr: Obj = l.tracking ?? {};
    const loc: Obj = l.location ?? {};
    const veh: Obj = l.vehicle ?? {};
    const [mm, yy] = String(tr.firstRegistration ?? "").split("-");
    const reg = yy && mm ? `${yy.padStart(4, "0")}-${mm.padStart(2, "0")}` : "";
    if (!reg || reg < minReg(today)) continue;
    if (Number(tr.mileage ?? Infinity) > MAX_KM || Number(tr.price ?? Infinity) > MAX_PRICE) continue;
    if (!isFlanders(loc.zip)) continue;
    if (veh.transmission !== "Manueel" || veh.fuel !== "Benzine") continue;
    const seller: Obj = l.seller ?? {};
    out.push({
      id: String(l.id), url: BASE + l.url, make: veh.make, model: veh.model, version: veh.modelVersionInput ?? "",
      reg, km: Number(tr.mileage), price: Number(tr.price), zip: String(loc.zip), town: loc.city ?? "",
      seller: seller.companyName ?? null, privateSeller: seller.type === "PrivateSeller",
      phone: (seller.phones?.[0]?.formattedNumber as string | undefined) ?? null,
    });
  }
  return out;
}

const zipCache = new Map<string, number | null>();

/** Estimated road km from Ieper for a Belgian postcode (free lookup, cached). */
async function distanceKm(zip: string): Promise<number | null> {
  if (!zipCache.has(zip)) {
    try {
      const res = await fetch(`https://api.zippopotam.us/be/${zip}`, { signal: AbortSignal.timeout(15_000) });
      const place = ((await res.json()) as Obj).places?.[0];
      zipCache.set(zip, place ? roadKm(haversineKm(IEPER, { lat: Number(place.latitude), lon: Number(place.longitude) })) : null);
    } catch {
      zipCache.set(zip, null);
    }
    await sleep(150);
  }
  return zipCache.get(zip) ?? null;
}

/** Turn the data embedded in a posting page into a Car. Returns null for anything that is not an SUV. */
export function carFromPosting(stub: Stub, detail: Obj): Car | null {
  const v: Obj = detail.vehicle ?? {};
  if (!String(v.bodyType ?? "").includes("SUV")) return null;
  const equipment: string[] = Object.values((v.equipment ?? {}) as Record<string, Obj[]>)
    .flatMap((cat) => (cat ?? []).map((item) => String(item.id ?? "")))
    .filter(Boolean);
  const description = stripHtml(detail.description);
  const blob = [description, equipment.join(" "), detail.title ?? "", stub.version].join(" ");
  return {
    source: "AutoScout24.be", id: stub.id, url: stub.url, make: stub.make, model: stub.model, version: stub.version,
    reg: stub.reg, km: stub.km, price: stub.price, town: stub.town, zip: stub.zip, distanceKm: null,
    seller: stub.seller, privateSeller: stub.privateSeller, phone: stub.phone, equipment,
    description: description.slice(0, 1200),
    gears: v.gears ?? gearsFromText(blob), powerKw: v.rawPowerInKw ?? null,
    owners: v.noOfPreviousOwners ?? null, accident: v.hadAccident ?? null, serviceHistory: v.hasFullServiceHistory ?? null,
    aaExplicit: aaExplicit(blob), aaInferred: aaInferred(blob), aaNeedsActivation: false, camera: hasCamera(blob),
  };
}

export async function scanAutoScout24(log: (m: string) => void, today = new Date()): Promise<Car[]> {
  const stubs = new Map<string, Stub>();
  let pagesRead = 0;
  for (const model of MODELS) {
    for (let page = 1; page <= 5; page++) {
      let pp: Obj | undefined;
      try {
        pp = nextData(await getText(searchUrl(model, page, today)))?.props?.pageProps;
      } catch (e) {
        log(`autoscout24 ${model}: ${(e as Error).message}`);
        break;
      }
      if (!pp) break;
      pagesRead++;
      for (const s of stubsFromResults(pp.listings ?? [], today)) stubs.set(s.id, s);
      if (page >= Number(pp.numberOfPages ?? 1)) break;
      await sleep(400);
    }
    await sleep(400);
  }
  if (pagesRead === 0) throw new Error("autoscout24: no result page could be read (blocked?)");
  log(`autoscout24: ${stubs.size} candidates, opening their postings`);

  const cars: Car[] = [];
  for (const stub of stubs.values()) {
    try {
      const detail = nextData(await getText(stub.url))?.props?.pageProps?.listingDetails as Obj | undefined;
      const car = detail ? carFromPosting(stub, detail) : null;
      if (car) cars.push({ ...car, distanceKm: await distanceKm(car.zip ?? "") });
    } catch (e) {
      log(`autoscout24 ${stub.url}: ${(e as Error).message}`);
    }
    await sleep(400);
  }
  log(`autoscout24: ${cars.length} SUVs`);
  return cars;
}
