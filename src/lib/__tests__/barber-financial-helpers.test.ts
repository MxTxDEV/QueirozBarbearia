import { describe, expect, it } from "vitest";
import { bucketKey, bucketLabel, deltaPercent, formatPercent, previousPeriodRange } from "../barber-financial-helpers";

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

  it("previousPeriodRange", () => {
    const u = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
    // hoje: ontem
    expect(previousPeriodRange("today", u(2026, 10, 7), u(2026, 10, 8))).toEqual({ from: u(2026, 10, 6), to: u(2026, 10, 7) });
    // 7 dias (8 dias corridos no sistema): o trecho de mesmo tamanho logo antes
    expect(previousPeriodRange("week", u(2026, 9, 30), u(2026, 10, 8))).toEqual({ from: u(2026, 9, 22), to: u(2026, 9, 30) });
    // mês até hoje (1..7 de outubro) x 1..7 de setembro
    expect(previousPeriodRange("month", u(2026, 10, 1), u(2026, 10, 8))).toEqual({ from: u(2026, 9, 1), to: u(2026, 9, 8) });
    // não invade o mês atual (fev tem menos dias que mar)
    expect(previousPeriodRange("month", u(2026, 3, 1), u(2026, 3, 31))).toEqual({ from: u(2026, 2, 1), to: u(2026, 3, 1) });
    expect(previousPeriodRange("year", u(2026, 1, 1), u(2026, 10, 8))).toEqual({ from: u(2025, 1, 1), to: u(2025, 10, 8) });
    expect(previousPeriodRange("all", u(2026, 1, 1), u(2026, 10, 8))).toBeNull();
  });

  it("deltaPercent", () => {
    expect(deltaPercent(150, 100)).toBe(50);
    expect(deltaPercent(50, 100)).toBe(-50);
    expect(deltaPercent(100, 0)).toBeNull();
  });
});
