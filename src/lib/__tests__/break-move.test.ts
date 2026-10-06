import { describe, it, expect } from "vitest";
import { overlapsAny, shiftWindow, validateBreakWindow } from "@/lib/break-move";
import { resolveBreak } from "@/lib/availability-helpers";

const WORK = { start: 540, end: 1140 }; // 09:00–19:00
const LUNCH = { start: 720, end: 780 }; // 12:00–13:00

describe("shiftWindow", () => {
  it("moves by the delta, snapped to 15 minutes", () => {
    expect(shiftWindow(LUNCH, 100, WORK)).toEqual({ start: 825, end: 885 }); // 100 -> 105
    expect(shiftWindow(LUNCH, -62, WORK)).toEqual({ start: 660, end: 720 }); // -62 -> -60
  });

  it("keeps the duration and never leaves the working window", () => {
    expect(shiftWindow(LUNCH, 5000, WORK)).toEqual({ start: 1080, end: 1140 });
    expect(shiftWindow(LUNCH, -5000, WORK)).toEqual({ start: 540, end: 600 });
  });
});

describe("overlapsAny", () => {
  it("detects overlap but allows touching edges", () => {
    expect(overlapsAny({ start: 600, end: 660 }, [{ start: 630, end: 700 }])).toBe(true);
    expect(overlapsAny({ start: 600, end: 660 }, [{ start: 660, end: 700 }])).toBe(false);
  });
});

describe("validateBreakWindow", () => {
  it("accepts a window inside working hours", () => {
    expect(validateBreakWindow({ start: 840, end: 900 }, WORK)).toBeNull();
  });
  it("rejects empty/inverted and out-of-hours windows", () => {
    expect(validateBreakWindow({ start: 900, end: 900 }, WORK)).toMatch(/depois do início/);
    expect(validateBreakWindow({ start: 500, end: 560 }, WORK)).toMatch(/dentro do horário/);
    expect(validateBreakWindow({ start: 1100, end: 1160 }, WORK)).toMatch(/dentro do horário/);
  });
});

describe("resolveBreak", () => {
  const weekly = { breakStart: "12:00", breakEnd: "13:00" };
  it("uses the weekly default without an override", () => {
    expect(resolveBreak(weekly)).toEqual({ start: "12:00", end: "13:00" });
    expect(resolveBreak(weekly, null)).toEqual({ start: "12:00", end: "13:00" });
  });
  it("the day override wins, even when it means no break", () => {
    expect(resolveBreak(weekly, { breakStart: "14:00", breakEnd: "15:00" })).toEqual({ start: "14:00", end: "15:00" });
    expect(resolveBreak(weekly, { breakStart: null, breakEnd: null })).toBeNull();
  });
  it("is null when the barber has no break at all", () => {
    expect(resolveBreak({ breakStart: null, breakEnd: null })).toBeNull();
  });
});
