import { describe, expect, it } from "vitest";
import { bucketKey, bucketLabel, formatPercent } from "../barber-financial-helpers";

describe("barber-financial-helpers", () => {
  const d = new Date(Date.UTC(2026, 9, 9, 15, 30));
  it("bucketKey", () => {
    expect(bucketKey(d, "day")).toBe("2026-10-09");
    expect(bucketKey(d, "month")).toBe("2026-10");
  });
  it("bucketLabel", () => {
    expect(bucketLabel("2026-10-09", "day")).toBe("09/10");
    expect(bucketLabel("2026-10", "month")).toBe("out/26");
    expect(bucketLabel("2027-01", "month")).toBe("jan/27");
  });
  it("formatPercent", () => {
    expect(formatPercent(43.456)).toBe("43,5%");
    expect(formatPercent(0)).toBe("0,0%");
  });
});
