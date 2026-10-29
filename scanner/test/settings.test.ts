import { describe, expect, it } from "vitest";
import { parseTopic } from "../src/settings.ts";

describe("parseTopic", () => {
  it("accepts a long random topic and trims it", () => {
    expect(parseTopic("  carwatch-Zk3q9TxP2mWvB7nLd4RaYe8s \n")).toBe("carwatch-Zk3q9TxP2mWvB7nLd4RaYe8s");
  });
  it.each([
    ["too short to be a password", "password"],
    ["empty", ""],
    ["has a slash", "carwatch/Zk3q9TxP2mWvB7nLd4RaYe8s"],
    ["has a space", "carwatch Zk3q9TxP2mWvB7nLd4RaYe8s"],
  ])("rejects a topic that is %s", (_label, value) => {
    expect(() => parseTopic(value)).toThrow("NTFY_TOPIC must be");
  });
  it("never repeats the rejected value in the error", () => {
    try {
      parseTopic("short-secret");
    } catch (e) {
      expect((e as Error).message).not.toContain("short-secret");
    }
  });
});
