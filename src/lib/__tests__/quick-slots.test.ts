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

import { buildClosedSegments, intersectSegments, coversWholeDay } from "@/lib/quick-slots";

describe("buildClosedSegments", () => {
  it("closes the whole day when the barber does not work that weekday", () => {
    const segs = buildClosedSegments({ working: null });
    expect(segs).toEqual([{ start: 0, end: 1440, reason: "Não atende neste dia" }]);
    expect(coversWholeDay(segs)).toBe(true);
  });

  it("time off beats everything", () => {
    const segs = buildClosedSegments({ working: { start: 540, end: 1140 }, timeOff: true });
    expect(segs).toEqual([{ start: 0, end: 1440, reason: "Folga" }]);
  });

  it("closes before opening, lunch and after closing", () => {
    const segs = buildClosedSegments({
      working: { start: 540, end: 1140 },
      breakInterval: { start: 720, end: 780 },
    });
    expect(segs).toEqual([
      { start: 0, end: 540, reason: "Fora do expediente" },
      { start: 720, end: 780, reason: "Intervalo" },
      { start: 1140, end: 1440, reason: "Fora do expediente" },
    ]);
    expect(coversWholeDay(segs)).toBe(false);
  });

  it("uses the block reason, falls back to 'Bloqueado', and does not double-paint lunch", () => {
    const segs = buildClosedSegments({
      working: { start: 540, end: 1140 },
      breakInterval: { start: 720, end: 780 },
      blocks: [
        { start: 700, end: 800, reason: "Médico" },
        { start: 900, end: 960, reason: "  " },
      ],
    });
    expect(segs.filter((s) => s.start >= 540 && s.end <= 1140)).toEqual([
      { start: 700, end: 720, reason: "Médico" },
      { start: 720, end: 780, reason: "Intervalo" },
      { start: 780, end: 800, reason: "Médico" },
      { start: 900, end: 960, reason: "Bloqueado" },
    ]);
  });
});

describe("intersectSegments", () => {
  it("keeps only what is closed for both", () => {
    const a = [{ start: 0, end: 600, reason: "Fora do expediente" }];
    const b = [{ start: 540, end: 700, reason: "Intervalo" }];
    expect(intersectSegments(a, b)).toEqual([{ start: 540, end: 600, reason: "Fora do expediente" }]);
  });

  it("is empty when one barber is open", () => {
    expect(intersectSegments([{ start: 0, end: 600, reason: "x" }], [])).toEqual([]);
  });
});
