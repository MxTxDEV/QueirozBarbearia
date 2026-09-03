import { describe, it, expect } from "vitest";
import { nextRecurrenceDate } from "@/lib/recurrence";

describe("nextRecurrenceDate", () => {
  it("advances weekly by 7 days", () => {
    const result = nextRecurrenceDate(new Date("2026-01-01T00:00:00Z"), "WEEKLY");
    expect(result?.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("advances monthly, rolling over into the next year at December", () => {
    const result = nextRecurrenceDate(new Date("2026-12-15T00:00:00Z"), "MONTHLY");
    expect(result?.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("advances yearly", () => {
    const result = nextRecurrenceDate(new Date("2026-06-01T00:00:00Z"), "YEARLY");
    expect(result?.toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("returns null for a non-recurring expense", () => {
    expect(nextRecurrenceDate(new Date("2026-06-01T00:00:00Z"), "NONE")).toBeNull();
  });

  it("handles a monthly recurrence starting on the 31st of a long month", () => {
    // Date's setUTCMonth "rolls over" when the target month is shorter — this
    // documents the current (accepted) behavior rather than asserting an
    // ideal one, so a future change to this edge case is a deliberate diff.
    const result = nextRecurrenceDate(new Date("2026-01-31T00:00:00Z"), "MONTHLY");
    expect(result?.toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });
});
