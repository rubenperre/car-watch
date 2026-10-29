import { describe, expect, it } from "vitest";
import { evaluate } from "../src/rank.ts";
import { evidence, ID_PREFIX, toRows } from "../src/rows.ts";
import type { Car } from "../src/types.ts";

const TODAY = new Date(2026, 9, 29);

function car(over: Partial<Car> = {}): Car {
  return {
    source: "AutoScout24.be", id: "abc-123", url: "https://www.autoscout24.be/nl/aanbod/x", make: "Ford", model: "Kuga",
    version: "Kuga 1.5 EcoBoost 150pk", reg: "2024-05", km: 27_000, price: 19_000, town: "Izegem", zip: "8870",
    distanceKm: 30, seller: "Garage X", privateSeller: false, phone: "+32 51 00 00 00",
    equipment: ["Android Auto", "Parkeerhulp met camera"], description: "", gears: 6, powerKw: 110, owners: 1,
    accident: false, serviceHistory: true, aaExplicit: true, aaInferred: false, aaNeedsActivation: false, camera: true,
    ...over,
  };
}

describe("evaluate: hard criteria", () => {
  it("keeps a car that fits", () => {
    expect(evaluate([car()], TODAY)).toHaveLength(1);
  });
  it.each([
    ["registered before the cut-off", { reg: "2022-10" }],
    ["too many km", { km: 50_001 }],
    ["over budget", { price: 20_001 }],
    ["a stated 5-speed", { gears: 5 }],
    ["title says automatic", { version: "Kuga 1.5 EcoBoost 150pk Automaat" }],
    ["a 70 kW VW-group car (5-speed)", { make: "Skoda", model: "Kamiq", gears: null, powerKw: 70 }],
  ] as const)("drops a car %s", (_label, over) => {
    expect(evaluate([car(over)], TODAY)).toHaveLength(0);
  });
  it("keeps a car whose gear count is unknown but flags it", () => {
    const [r] = evaluate([car({ gears: null })], TODAY);
    expect(r?.gearsOk).toBe(false);
  });
});

describe("evaluate: flags and order", () => {
  it("ok means Android Auto and camera are both in the posting", () => {
    expect(evaluate([car()], TODAY)[0]?.ok).toBe(true);
    expect(evaluate([car({ camera: false })], TODAY)[0]?.ok).toBe(false);
  });
  it("counts an inferred system as Android Auto", () => {
    const [r] = evaluate([car({ aaExplicit: false, aaInferred: true })], TODAY);
    expect(r?.aaOk).toBe(true);
  });
  it("ranks PureTech engines below an otherwise equal car", () => {
    const ranked = evaluate([car({ id: "pt", make: "Peugeot", model: "2008" }), car({ id: "ok" })], TODAY);
    expect(ranked.map((r) => r.id)).toEqual(["ok", "pt"]);
  });
  it("ranks a nearer car above a farther one", () => {
    const ranked = evaluate([car({ id: "far", distanceKm: 100 }), car({ id: "near", distanceKm: 20 })], TODAY);
    expect(ranked[0]?.id).toBe("near");
  });
});

describe("toRows", () => {
  it("prefixes the id with the source and marks a full match", () => {
    const [row] = toRows(evaluate([car()], TODAY));
    expect(row?.id).toBe(`${ID_PREFIX["AutoScout24.be"]}-abc-123`);
    expect(row?.match).toBe("full");
    expect(row?.android_auto).toBe("confirmed");
  });
  it("leaves out cars with unknown gears, PureTech and cars far from Ieper", () => {
    const ranked = evaluate(
      [car({ id: "g", gears: null }), car({ id: "p", make: "Opel", model: "Mokka" }), car({ id: "f", distanceKm: 300 })],
      TODAY,
    );
    expect(toRows(ranked)).toHaveLength(0);
  });
  it("keeps a partial match (only one of the two) and labels it", () => {
    const [row] = toRows(evaluate([car({ camera: false, equipment: ["Android Auto"] })], TODAY));
    expect(row?.match).toBe("partial");
    expect(row?.camera).toBe("missing");
  });
  it("lets delivered cars (no location) through", () => {
    const rows = toRows(evaluate([car({ source: "Autohero", id: "h", distanceKm: null, town: "levering aan huis" })], TODAY));
    expect(rows).toHaveLength(1);
  });
});

describe("evidence", () => {
  it("quotes the equipment lines that prove it", () => {
    const [r] = evaluate([car()], TODAY);
    expect(evidence(r as NonNullable<typeof r>)).toBe("Android Auto; Parkeerhulp met camera");
  });
  it("falls back to a snippet of the description", () => {
    const [r] = evaluate([car({ equipment: [], description: "Super auto met Android Auto en camera achteraan." })], TODAY);
    expect(evidence(r as NonNullable<typeof r>)).toContain("Android Auto");
  });
});
