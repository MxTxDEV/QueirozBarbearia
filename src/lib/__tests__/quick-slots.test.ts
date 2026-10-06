import { describe, it, expect } from "vitest";
import { subtractIntervals, openSlotStarts, minutesToHHMM, hhmmToMinutes } from "@/lib/quick-slots";

describe("subtractIntervals", () => {
  it("returns the interval untouched when nothing is busy", () => {
    expect(subtractIntervals([{ start: 540, end: 720 }], [])).toEqual([{ start: 540, end: 720 }]);
  });

  it("splits an interval around a busy window in the middle", () => {
    expect(subtractIntervals([{ start: 540, end: 720 }], [{ start: 600, end: 630 }])).toEqual([
      { start: 540, end: 600 },
      { start: 630, end: 720 },
    ]);
  });

  it("trims edges and removes fully covered intervals", () => {
    expect(subtractIntervals([{ start: 540, end: 720 }], [{ start: 500, end: 560 }, { start: 700, end: 800 }])).toEqual([
      { start: 560, end: 700 },
    ]);
    expect(subtractIntervals([{ start: 540, end: 600 }], [{ start: 500, end: 700 }])).toEqual([]);
  });

  it("handles a lunch break plus an appointment (several busy windows)", () => {
    const open = [{ start: 540, end: 1140 }]; // 09:00–19:00
    const busy = [
      { start: 720, end: 780 }, // almoço 12–13
      { start: 600, end: 630 }, // 10:00–10:30
    ];
    expect(subtractIntervals(open, busy)).toEqual([
      { start: 540, end: 600 },
      { start: 630, end: 720 },
      { start: 780, end: 1140 },
    ]);
  });
});

describe("openSlotStarts", () => {
  it("lists 30-minute cells fully inside open intervals", () => {
    expect(openSlotStarts([{ start: 540, end: 630 }]).map(minutesToHHMM)).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("aligns to the grid, not to the interval start", () => {
    expect(openSlotStarts([{ start: 550, end: 660 }]).map(minutesToHHMM)).toEqual(["09:30", "10:00", "10:30"]);
  });

  it("drops cells that do not fit entirely", () => {
    expect(openSlotStarts([{ start: 540, end: 559 }])).toEqual([]);
  });

  it("hides cells before notBeforeMinute (past today)", () => {
    expect(openSlotStarts([{ start: 540, end: 660 }], 30, 600).map(minutesToHHMM)).toEqual(["10:00", "10:30"]);
  });
});

describe("HH:MM helpers", () => {
  it("round-trips", () => {
    expect(minutesToHHMM(hhmmToMinutes("18:05"))).toBe("18:05");
    expect(hhmmToMinutes("00:30")).toBe(30);
  });
});
