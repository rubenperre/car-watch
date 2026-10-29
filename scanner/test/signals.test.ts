import { describe, expect, it } from "vitest";
import { aaExplicit, aaInferred, gearsFromText, hasCamera } from "../src/signals.ts";
import { decodeEntities, digits, haversineKm, stripHtml } from "../src/text.ts";

describe("gearsFromText", () => {
  it.each([
    ["Kamiq 1.0 TSI 95 M5F", 5],
    ["Juke 1.0 DIG-T 114 6MT N-Connecta", 6],
    ["Opel Mokka 1.2 MT6 100pk", 6],
    ["versnellingsbak: manueel 6", 6],
    ["manuele versnellingsbak – 6 versnellingen", 6],
    ["Kamiq Clever 1,0 TSI 70 kW 5-speed mech.", 5],
  ])("%s -> %i", (text, expected) => {
    expect(gearsFromText(text)).toBe(expected);
  });

  it("does not read the 0 in '1.0 mt' as a gear count (old Python bug)", () => {
    expect(gearsFromText("Renault Captur 1.0 mt tce techno")).toBeNull();
  });
  it("returns null when nothing is stated", () => {
    expect(gearsFromText("Ford Kuga Cool & Connect 1.5i EcoBoost 150pk")).toBeNull();
  });
});

describe("Android Auto and camera", () => {
  it("needs the words in the posting for the explicit check", () => {
    expect(aaExplicit("Apple CarPlay, Android Auto, Bluetooth")).toBe(true);
    expect(aaExplicit("Apple CarPlay, Bluetooth")).toBe(false);
  });
  it("treats system names as a weaker, separate signal", () => {
    expect(aaInferred("SEAT Full Link")).toBe(true);
    expect(aaInferred("VW App-Connect")).toBe(true);
    expect(aaExplicit("SEAT Full Link")).toBe(false);
  });
  it("finds a camera in Dutch and French", () => {
    expect(hasCamera("Parkeerhulp met camera")).toBe(true);
    expect(hasCamera("Achteruitrijcamera")).toBe(true);
    expect(hasCamera("caméra de recul")).toBe(true);
    expect(hasCamera("Parkeerhulp achter")).toBe(false);
  });
});

describe("text helpers", () => {
  it("decodes HTML entities", () => {
    expect(decodeEntities("Q&amp;S Motors &#x27;n&#39;")).toBe("Q&S Motors 'n'");
  });
  it("strips tags and collapses whitespace", () => {
    expect(stripHtml("<strong>Android Auto</strong><br />camera &amp; GPS")).toBe("Android Auto camera & GPS");
  });
  it("reads numbers out of Belgian formatting", () => {
    expect(digits("41.795 km")).toBe(41795);
    expect(digits(undefined)).toBeNull();
  });
  it("measures Ieper to Kortrijk at about 30 km straight", () => {
    const d = haversineKm({ lat: 50.8514, lon: 2.885 }, { lat: 50.828, lon: 3.265 });
    expect(d).toBeGreaterThan(25);
    expect(d).toBeLessThan(30);
  });
});
