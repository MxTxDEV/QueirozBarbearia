import { describe, it, expect } from "vitest";
import { timeOnDate, dateOnly, overlaps } from "@/lib/availability-helpers";

describe("timeOnDate", () => {
  it("builds a UTC date from a Y-M-D date and HH:mm string", () => {
    const day = new Date(Date.UTC(2026, 5, 15));
    const result = timeOnDate(day, "14:30");
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(14);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it("is stable regardless of the host timezone (always UTC)", () => {
    const day = new Date(Date.UTC(2026, 0, 1));
    const result = timeOnDate(day, "00:00");
    expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("dateOnly", () => {
  it("strips the time component, keeping only Y-M-D in UTC", () => {
    const withTime = new Date(Date.UTC(2026, 2, 10, 23, 59, 59));
    const result = dateOnly(withTime);
    expect(result.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });
});

describe("overlaps", () => {
  it("detects a straightforward overlap", () => {
    const a = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z")] as const;
    const b = [new Date("2026-01-01T10:30:00Z"), new Date("2026-01-01T11:30:00Z")] as const;
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(true);
  });

  it("returns false for back-to-back appointments (end === start)", () => {
    const a = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z")] as const;
    const b = [new Date("2026-01-01T11:00:00Z"), new Date("2026-01-01T12:00:00Z")] as const;
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(false);
  });

  it("returns false for appointments on entirely separate windows", () => {
    const a = [new Date("2026-01-01T09:00:00Z"), new Date("2026-01-01T10:00:00Z")] as const;
    const b = [new Date("2026-01-01T14:00:00Z"), new Date("2026-01-01T15:00:00Z")] as const;
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(false);
  });

  it("detects when one appointment fully contains the other", () => {
    const outer = [new Date("2026-01-01T09:00:00Z"), new Date("2026-01-01T18:00:00Z")] as const;
    const inner = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T10:30:00Z")] as const;
    expect(overlaps(outer[0], outer[1], inner[0], inner[1])).toBe(true);
    expect(overlaps(inner[0], inner[1], outer[0], outer[1])).toBe(true);
  });
});
