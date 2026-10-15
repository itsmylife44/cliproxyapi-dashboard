import { describe, expect, it } from "vitest";
import { isRecord } from "@/lib/utils";

describe("isRecord", () => {
  it("accepts plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("rejects null, arrays and primitives", () => {
    for (const value of [null, undefined, [], [1], "x", 1, true]) {
      expect(isRecord(value)).toBe(false);
    }
  });
});
