import { describe, expect, it } from "vitest";
import { carFromPosting as cardoenCar, itemsFromResults } from "../src/sources/cardoen.ts";
import { carFromPosting as autoheroCar, productsFromResults, regFromDotted } from "../src/sources/autohero.ts";
import { stubsFromResults } from "../src/sources/autoscout24.ts";

const TODAY = new Date(2026, 9, 29);

describe("AutoScout24 results", () => {
  const listing = (over: Record<string, unknown> = {}) => ({
    id: "id-1", url: "/nl/aanbod/kia-xceed-1", tracking: { firstRegistration: "04-2024", mileage: "28747", price: "18700" },
    location: { zip: "1760", city: "Roosdaal" }, vehicle: { make: "Kia", model: "XCeed", modelVersionInput: "XCeed 1.0 T-GDi", transmission: "Manueel", fuel: "Benzine" },
    seller: { companyName: "Garage Jean-Claude", type: "Dealer", phones: [{ formattedNumber: "+32 477 26 37 68" }] },
    ...over,
  });

  it("builds a stub with an absolute link", () => {
    const [s] = stubsFromResults([listing()], TODAY);
    expect(s).toMatchObject({ id: "id-1", url: "https://www.autoscout24.be/nl/aanbod/kia-xceed-1", reg: "2024-04", km: 28747, price: 18700, town: "Roosdaal" });
  });
  it.each([
    ["Wallonia", { location: { zip: "5100", city: "Namur" } }],
    ["too old", { tracking: { firstRegistration: "09-2022", mileage: "10000", price: "15000" } }],
    ["automatic", { vehicle: { make: "Kia", model: "XCeed", transmission: "Automatisch", fuel: "Benzine" } }],
    ["diesel", { vehicle: { make: "Kia", model: "XCeed", transmission: "Manueel", fuel: "Diesel" } }],
  ])("skips a car that is %s", (_label, over) => {
    expect(stubsFromResults([listing(over)], TODAY)).toHaveLength(0);
  });
});

describe("Autohero", () => {
  const page = `<script type="application/ld+json">{"@type":"Product","productID":"p1","name":"Dacia Duster","brand":"Dacia","description":"1.2 TCe Mild-Hybrid","url":"https://autohero.com/nl-be/dacia-duster/id/p1/","offers":[{"price":18199}]}</script>
  <script type="application/ld+json">not json</script>`;
  const posting = `<span class="listItemTitle x">Eerste inschrijving</span><h5 class="a">08.07.2025</h5>
  <span class="listItemTitle x">Kilometerstand</span><h5 class="a">14.903 km</h5>
  <span class="listItemTitle x">Vermogen</span><h5 class="a">131 PK / 96 kW</h5>
  <li data-qa-selector="equipment-value">Achteruitrijcamera</li><li data-qa-selector="equipment-value">Android Auto (Activering door koper)</li>
  <li data-qa-selector="equipment-value">Manueel 6 Versnellingen</li>`;

  it("reads products from ld+json and ignores broken blocks", () => {
    expect(productsFromResults(page)).toEqual([
      { id: "p1", url: "https://autohero.com/nl-be/dacia-duster/id/p1/", brand: "Dacia", name: "Dacia Duster", version: "1.2 TCe Mild-Hybrid", price: 18199 },
    ]);
  });
  it("reads the facts and equipment of a posting", () => {
    const [p] = productsFromResults(page);
    const car = autoheroCar(p as NonNullable<typeof p>, posting);
    expect(car).toMatchObject({ reg: "2025-07", km: 14903, powerKw: 96, gears: 6, camera: true, aaExplicit: true, aaNeedsActivation: true });
  });
  it("converts dotted dates", () => {
    expect(regFromDotted("31.03.2022")).toBe("2022-03");
    expect(regFromDotted(undefined)).toBe("");
  });
});

describe("Cardoen", () => {
  const list = `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"item":{"url":"https://www.cardoen.be/nl/auto/x/1","name":"Opel Crossland 1.2 turbo"}}]}</script>`;
  const posting = (reg: string, km: number, price: number) =>
    `<script type="application/ld+json">{"@type":"Car","sku":"338","brand":{"name":"Opel"},"model":"Crossland","dateVehicleFirstRegistered":"${reg}T00:00:00","mileageFromOdometer":{"value":${km}},"offers":{"price":${price}},"vehicleEngine":{"enginePower":{"value":81}}}</script>` +
    `<span class="ds-text--body--xsmall ds-text--normal"><!--[--><!--[-->Android Auto<!--]--></span>Aantal versnellingen : 6`;
  const item = { url: "https://www.cardoen.be/nl/auto/x/1", name: "Opel Crossland 1.2 turbo" };

  it("reads the list", () => {
    expect(itemsFromResults(list)).toEqual([item]);
  });
  it("reads a fitting posting", () => {
    expect(cardoenCar(item, posting("2023-04-01", 13871, 14199), TODAY)).toMatchObject({ id: "338", reg: "2023-04", gears: 6, aaExplicit: true, powerKw: 81 });
  });
  it("returns null when age, km or price do not fit", () => {
    expect(cardoenCar(item, posting("2022-01-14", 13871, 14199), TODAY)).toBeNull();
    expect(cardoenCar(item, posting("2023-04-01", 60000, 14199), TODAY)).toBeNull();
    expect(cardoenCar(item, posting("2023-04-01", 13871, 25000), TODAY)).toBeNull();
  });
});
