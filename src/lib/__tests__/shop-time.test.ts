import { describe, it, expect } from "vitest";
import { shopNow, shopTodayIso } from "@/lib/shop-time";

describe("shopNow", () => {
  it("converts a real UTC instant to the São Paulo wall clock (UTC-3)", () => {
    // 17:00Z é 14:00 em São Paulo — era aqui que "hoje só abria às 17h".
    expect(shopNow(new Date("2026-10-06T17:00:00Z")).toISOString()).toBe("2026-10-06T14:00:00.000Z");
  });

  it("rolls the date back after midnight UTC but before midnight in Brazil", () => {
    // 01:30Z do dia 7 ainda é 22:30 do dia 6 em São Paulo.
    expect(shopTodayIso(new Date("2026-10-07T01:30:00Z"))).toBe("2026-10-06");
  });

  it("is independent of the host timezone", () => {
    const original = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    try {
      expect(shopNow(new Date("2026-01-15T12:00:00Z")).toISOString()).toBe("2026-01-15T09:00:00.000Z");
    } finally {
      process.env.TZ = original;
    }
  });
});
