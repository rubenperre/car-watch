import { describe, expect, it } from "vitest";
import { parseEmails } from "../src/admins.ts";

describe("parseEmails", () => {
  it("lower-cases, trims and removes duplicates", () => {
    expect(parseEmails(" Ruben@Example.com, ruben@example.com ;liesbeth@example.com\n")).toEqual([
      "ruben@example.com",
      "liesbeth@example.com",
    ]);
  });
  it("returns an empty list for an empty secret", () => {
    expect(parseEmails("")).toEqual([]);
    expect(parseEmails("  ,  ")).toEqual([]);
  });
  it("rejects a value that is not an address, without repeating it", () => {
    expect(() => parseEmails("ruben@example.com, not-an-email")).toThrow("not an email address");
    expect(() => parseEmails("secret-looking-text")).not.toThrow(/secret-looking-text/);
  });
});
