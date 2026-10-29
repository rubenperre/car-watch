import { MAX_KM, MAX_PRICE, minRegYear } from "../criteria.ts";
import { getText, ldJson, sleep } from "../http.ts";
import { aaExplicit, hasCamera } from "../signals.ts";
import { decodeEntities, digits } from "../text.ts";
import type { Car } from "../types.ts";

const searchUrl = (page: number, today: Date) =>
  "https://www.autohero.com/nl-be/search/?bodyType=suv&fuelType=petrol&transmission=manual" +
  `&mileageMax=${MAX_KM}&priceMax=${MAX_PRICE}&yearMin=${minRegYear(today)}&page=${page}`;

interface Product {
  id: string;
  url: string;
  brand: string;
  name: string;
  version: string;
  price: number;
}

/** The cars on a results page: each one is a schema.org Product in a ld+json block. Exported for tests. */
export function productsFromResults(html: string): Product[] {
  return ldJson(html)
    .filter((j) => j["@type"] === "Product")
    .map((j) => ({
      id: String(j.productID), url: String(j.url), brand: String(j.brand ?? ""), name: String(j.name ?? ""),
      version: String(j.description ?? ""), price: Number(j.offers?.[0]?.price ?? 0),
    }));
}

/** "31.03.2022" -> "2022-03" */
export const regFromDotted = (s: string | undefined): string => {
  const [, mm, yy] = (s ?? "").split(".");
  return yy && mm ? `${yy}-${mm}` : "";
};

/** Key facts (km, registration, power) are listed as title/value pairs on the posting page. */
export function carFromPosting(p: Product, html: string): Car {
  const facts: Record<string, string> = {};
  for (const m of html.matchAll(/<span class="listItemTitle[^"]*">([^<]+)<\/span><h5[^>]*>([^<]+)<\/h5>/g)) {
    facts[decodeEntities(m[1] ?? "").trim()] = decodeEntities(m[2] ?? "").trim();
  }
  const equipment = [...html.matchAll(/data-qa-selector="equipment-value">([^<]+)</g)].map((m) => decodeEntities(m[1] ?? ""));
  const blob = equipment.join(" ");
  const gears = /manueel\s+(\d)\s+versnellingen/i.exec(blob);
  const kw = /(\d+)\s*kW/i.exec(facts["Vermogen"] ?? "");
  return {
    source: "Autohero", id: p.id, url: p.url, make: p.brand, model: p.name, version: p.version,
    reg: regFromDotted(facts["Eerste inschrijving"]), km: digits(facts["Kilometerstand"]) ?? 0, price: p.price,
    town: "levering aan huis", zip: null, distanceKm: null, seller: "Autohero", privateSeller: false, phone: null,
    equipment, description: "", gears: gears?.[1] ? Number(gears[1]) : null, powerKw: kw?.[1] ? Number(kw[1]) : null,
    owners: digits(facts["Aantal vorige eigenaren"]), accident: null, serviceHistory: null,
    aaExplicit: aaExplicit(blob), aaInferred: false, aaNeedsActivation: /android auto \(activering door koper\)/i.test(blob),
    camera: hasCamera(blob),
  };
}

export async function scanAutohero(log: (m: string) => void, today = new Date()): Promise<Car[]> {
  const products = new Map<string, Product>();
  for (let page = 1; page <= 5; page++) {
    const found = productsFromResults(await getText(searchUrl(page, today))).filter((p) => !products.has(p.id));
    for (const p of found) products.set(p.id, p);
    if (found.length === 0) break;
    await sleep(500);
  }
  const cars: Car[] = [];
  for (const p of products.values()) {
    try {
      cars.push(carFromPosting(p, await getText(p.url)));
    } catch (e) {
      log(`autohero ${p.url}: ${(e as Error).message}`);
    }
    await sleep(500);
  }
  log(`autohero: ${cars.length} cars`);
  return cars;
}
