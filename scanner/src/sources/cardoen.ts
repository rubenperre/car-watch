import { MAX_KM, MAX_PRICE, minReg } from "../criteria.ts";
import { getText, ldJson, sleep, type Obj } from "../http.ts";
import { aaExplicit, hasCamera } from "../signals.ts";
import { decodeEntities } from "../text.ts";
import type { Car } from "../types.ts";

const listUrl = (page: number) => `https://www.cardoen.be/nl/auto-kopen/tweedehands/suv/benzine/manueel/?page=${page}`;

interface Item {
  url: string;
  name: string;
}

/** The cars on a results page: an ItemList in a ld+json block. Exported for tests. */
export function itemsFromResults(html: string): Item[] {
  const list = ldJson(html).find((j) => j["@type"] === "ItemList");
  return ((list?.itemListElement ?? []) as Obj[]).map((e) => ({ url: String(e.item?.url), name: String(e.item?.name ?? "") }));
}

/** Read a posting page. Returns null when the car does not fit age, km or price. Exported for tests. */
export function carFromPosting(item: Item, html: string, today: Date): Car | null {
  const car = ldJson(html).find((j) => j["@type"] === "Car");
  if (!car) return null;
  const reg = String(car.dateVehicleFirstRegistered ?? "").slice(0, 7);
  const km = car.mileageFromOdometer?.value as number | undefined;
  const price = car.offers?.price as number | undefined;
  if (!(reg >= minReg(today) && km !== undefined && km <= MAX_KM && price !== undefined && price <= MAX_PRICE)) return null;
  const equipment = [...html.matchAll(/ds-text--body--xsmall ds-text--normal"><!--\[--><!--\[-->([^<]+)<!--\]-->/g)].map((m) =>
    decodeEntities(m[1] ?? "").trim(),
  );
  const blob = `${equipment.join(" ")} ${item.name}`;
  const gears = /aantal versnellingen\s*:\s*(\d+)/i.exec(html);
  return {
    source: "Cardoen.be", id: String(car.sku), url: item.url, make: car.brand?.name ?? "", model: car.model ?? "", version: item.name,
    reg, km, price, town: "Cardoen", zip: null, distanceKm: null, seller: "Cardoen", privateSeller: false, phone: null,
    equipment, description: "", gears: gears?.[1] ? Number(gears[1]) : null, powerKw: car.vehicleEngine?.enginePower?.value ?? null,
    owners: null, accident: null, serviceHistory: null,
    aaExplicit: aaExplicit(blob), aaInferred: false, aaNeedsActivation: false, camera: hasCamera(blob),
  };
}

export async function scanCardoen(log: (m: string) => void, today = new Date()): Promise<Car[]> {
  const items = new Map<string, Item>();
  for (let page = 1; page <= 7; page++) {
    const found = itemsFromResults(await getText(listUrl(page))).filter((i) => !items.has(i.url));
    for (const i of found) items.set(i.url, i);
    if (found.length === 0) break;
    await sleep(500);
  }
  const cars: Car[] = [];
  for (const item of items.values()) {
    try {
      const car = carFromPosting(item, await getText(item.url), today);
      if (car) cars.push(car);
    } catch (e) {
      log(`cardoen ${item.url}: ${(e as Error).message}`);
    }
    await sleep(500);
  }
  log(`cardoen: ${items.size} listed, ${cars.length} fit age, km and price`);
  return cars;
}
