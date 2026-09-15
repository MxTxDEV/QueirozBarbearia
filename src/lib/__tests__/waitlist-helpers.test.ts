import { describe, it, expect } from "vitest";
import {
  WAITLIST_HOLD_DURATION_MINUTES,
  toleranceWindow,
  isWithinTolerance,
  findClosestAvailableSlot,
  compareWaitlistCandidateMatches,
  rankWaitlistCandidateMatches,
  type WaitlistCandidateMatch,
} from "@/lib/waitlist-helpers";

describe("WAITLIST_HOLD_DURATION_MINUTES", () => {
  it("is the single source of truth for the hold duration (15 minutes)", () => {
    expect(WAITLIST_HOLD_DURATION_MINUTES).toBe(15);
  });
});

describe("toleranceWindow / isWithinTolerance", () => {
  const preferred = new Date("2026-09-20T18:00:00Z");

  it("accepts a candidate exactly at the preferred time", () => {
    expect(isWithinTolerance(preferred, preferred, 60)).toBe(true);
  });

  it("accepts a candidate at the edges of the tolerance window (18:00 ± 60min)", () => {
    const { min, max } = toleranceWindow(preferred, 60);
    expect(min.toISOString()).toBe("2026-09-20T17:00:00.000Z");
    expect(max.toISOString()).toBe("2026-09-20T19:00:00.000Z");
    expect(isWithinTolerance(min, preferred, 60)).toBe(true);
    expect(isWithinTolerance(max, preferred, 60)).toBe(true);
  });

  it("rejects a candidate just outside the tolerance window", () => {
    const justBefore = new Date("2026-09-20T16:59:00Z");
    const justAfter = new Date("2026-09-20T19:01:00Z");
    expect(isWithinTolerance(justBefore, preferred, 60)).toBe(false);
    expect(isWithinTolerance(justAfter, preferred, 60)).toBe(false);
  });
});

describe("findClosestAvailableSlot", () => {
  const preferred = new Date("2026-09-20T18:00:00Z");

  it("picks the exact match when available", () => {
    const slots = [
      { start: new Date("2026-09-20T17:00:00Z") },
      { start: new Date("2026-09-20T18:00:00Z") },
      { start: new Date("2026-09-20T19:00:00Z") },
    ];
    const result = findClosestAvailableSlot(preferred, 60, slots);
    expect(result?.start.toISOString()).toBe("2026-09-20T18:00:00.000Z");
  });

  it("picks the nearest slot within tolerance when there's no exact match", () => {
    const slots = [{ start: new Date("2026-09-20T17:15:00Z") }, { start: new Date("2026-09-20T18:45:00Z") }];
    // 18:15 is 45min away, 18:45 is 45min away too -> tie broken by earliest start.
    const result = findClosestAvailableSlot(preferred, 60, slots);
    expect(result?.start.toISOString()).toBe("2026-09-20T17:15:00.000Z");
  });

  it("returns null when nothing falls within the tolerance window", () => {
    const slots = [{ start: new Date("2026-09-20T10:00:00Z") }, { start: new Date("2026-09-20T22:00:00Z") }];
    expect(findClosestAvailableSlot(preferred, 60, slots)).toBeNull();
  });

  it("returns null for an empty slot list", () => {
    expect(findClosestAvailableSlot(preferred, 60, [])).toBeNull();
  });
});

describe("compareWaitlistCandidateMatches / rankWaitlistCandidateMatches", () => {
  const base: WaitlistCandidateMatch = {
    entryId: "a",
    exactTimeMatch: false,
    requestedThisBarber: false,
    distanceMs: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("prioritizes an exact time match above everything else", () => {
    const exact: WaitlistCandidateMatch = { ...base, entryId: "exact", exactTimeMatch: true, distanceMs: 30 * 60_000 };
    const close: WaitlistCandidateMatch = { ...base, entryId: "close", exactTimeMatch: false, distanceMs: 0 };
    const ranked = rankWaitlistCandidateMatches([close, exact]);
    expect(ranked[0].entryId).toBe("exact");
  });

  it("prioritizes a specifically-requested barber over distance", () => {
    const requested: WaitlistCandidateMatch = { ...base, entryId: "requested", requestedThisBarber: true, distanceMs: 45 * 60_000 };
    const anyBarber: WaitlistCandidateMatch = { ...base, entryId: "any", requestedThisBarber: false, distanceMs: 5 * 60_000 };
    const ranked = rankWaitlistCandidateMatches([anyBarber, requested]);
    expect(ranked[0].entryId).toBe("requested");
  });

  it("falls back to smaller distance to preferred time", () => {
    const near: WaitlistCandidateMatch = { ...base, entryId: "near", distanceMs: 10 * 60_000 };
    const far: WaitlistCandidateMatch = { ...base, entryId: "far", distanceMs: 40 * 60_000 };
    const ranked = rankWaitlistCandidateMatches([far, near]);
    expect(ranked[0].entryId).toBe("near");
  });

  it("falls back to earliest createdAt (joined the waitlist first) as the final tiebreak", () => {
    const scenario4A: WaitlistCandidateMatch = {
      entryId: "clientA",
      exactTimeMatch: true,
      requestedThisBarber: false,
      distanceMs: 0,
      createdAt: new Date("2026-01-01T10:00:00Z"),
    };
    const scenario4B: WaitlistCandidateMatch = {
      entryId: "clientB",
      exactTimeMatch: true,
      requestedThisBarber: false,
      distanceMs: 0,
      createdAt: new Date("2026-01-01T09:00:00Z"),
    };
    // Requirement scenario #49: both want 18:30, B entered the waitlist earlier -> B wins.
    const ranked = rankWaitlistCandidateMatches([scenario4A, scenario4B]);
    expect(ranked[0].entryId).toBe("clientB");
  });

  it("is fully deterministic (stable id tiebreak) when everything else ties", () => {
    const x: WaitlistCandidateMatch = { ...base, entryId: "x" };
    const y: WaitlistCandidateMatch = { ...base, entryId: "y" };
    expect(compareWaitlistCandidateMatches(x, y)).toBeLessThan(0);
    expect(compareWaitlistCandidateMatches(y, x)).toBeGreaterThan(0);
    expect(compareWaitlistCandidateMatches(x, x)).toBe(0);
  });

  it("never picks randomly — ranking the same input twice gives the same order", () => {
    const matches: WaitlistCandidateMatch[] = [
      { entryId: "1", exactTimeMatch: false, requestedThisBarber: true, distanceMs: 20 * 60_000, createdAt: new Date("2026-01-01T00:00:00Z") },
      { entryId: "2", exactTimeMatch: true, requestedThisBarber: false, distanceMs: 0, createdAt: new Date("2026-01-02T00:00:00Z") },
      { entryId: "3", exactTimeMatch: false, requestedThisBarber: false, distanceMs: 5 * 60_000, createdAt: new Date("2026-01-01T00:00:00Z") },
    ];
    const first = rankWaitlistCandidateMatches(matches).map((m) => m.entryId);
    const second = rankWaitlistCandidateMatches(matches).map((m) => m.entryId);
    expect(first).toEqual(second);
    expect(first).toEqual(["2", "1", "3"]);
  });
});
