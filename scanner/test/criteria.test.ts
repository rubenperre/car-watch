import { describe, expect, it } from "vitest";
import { isFlanders, minReg, minRegYear } from "../src/criteria.ts";

describe("minReg", () => {
  it("is the month after today's month, four years back", () => {
    expect(minReg(new Date(2026, 9, 29))).toBe("2022-11");
  });
  it("rolls over in December", () => {
    expect(minReg(new Date(2026, 11, 15))).toBe("2023-01");
  });
  it("handles January", () => {
    expect(minReg(new Date(2027, 0, 5))).toBe("2023-02");
  });
  it("gives the year used in the search URLs", () => {
    expect(minRegYear(new Date(2026, 9, 29))).toBe(2022);
  });
});

describe("isFlanders", () => {
  it.each([
    ["8900", true], // Ieper
    ["9000", true], // Gent
    ["3500", true], // Hasselt
    ["1500", true], // Halle
    ["1000", false], // Brussels
    ["4000", false], // Liège
    ["5100", false], // Namur
    ["7000", false], // Mons
    ["", false],
  ])("%s -> %s", (zip, expected) => {
    expect(isFlanders(zip)).toBe(expected);
  });
});
