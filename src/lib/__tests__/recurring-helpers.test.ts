import { describe, it, expect } from "vitest";
import {
  addUtcDays,
  addUtcMonthsClamped,
  addUtcWeeks,
  nthOccurrenceDate,
  generateOccurrenceDates,
  describeFrequency,
  RECURRING_FREQUENCY_PRESETS,
} from "@/lib/recurring-helpers";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

describe("addUtcDays / addUtcWeeks", () => {
  it("adds days in UTC regardless of host timezone", () => {
    const d = new Date(Date.UTC(2026, 8, 20)); // 2026-09-20
    expect(iso(addUtcDays(d, 15))).toBe("2026-10-05");
    expect(iso(addUtcWeeks(d, 2))).toBe("2026-10-04");
  });
});

describe("addUtcMonthsClamped", () => {
  it("keeps the same day of month when the target month is long enough", () => {
    const d = new Date(Date.UTC(2026, 5, 20)); // 20/06/2026
    expect(iso(addUtcMonthsClamped(d, 1))).toBe("2026-07-20");
  });

  it("clamps Jan 31 + 1 month to the last day of February (non-leap year)", () => {
    const d = new Date(Date.UTC(2027, 0, 31)); // 31/01/2027 (not a leap year)
    expect(iso(addUtcMonthsClamped(d, 1))).toBe("2027-02-28");
  });

  it("clamps Jan 31 + 1 month to Feb 29 on a leap year", () => {
    const d = new Date(Date.UTC(2028, 0, 31)); // 2028 is a leap year
    expect(iso(addUtcMonthsClamped(d, 1))).toBe("2028-02-29");
  });

  it("handles multi-month rollover correctly (31/12 + 2 months = 28/02 or 29/02)", () => {
    const d = new Date(Date.UTC(2026, 11, 31));
    expect(iso(addUtcMonthsClamped(d, 2))).toBe("2027-02-28");
  });

  it("preserves the time-of-day component", () => {
    const d = new Date(Date.UTC(2026, 8, 20, 18, 30, 0));
    const result = addUtcMonthsClamped(d, 1);
    expect(result.getUTCHours()).toBe(18);
    expect(result.getUTCMinutes()).toBe(30);
  });
});

describe("nthOccurrenceDate", () => {
  it("returns the start date itself for n=0", () => {
    const start = new Date(Date.UTC(2026, 8, 20));
    expect(iso(nthOccurrenceDate(start, "DAYS", 15, 0))).toBe("2026-09-20");
  });
});

describe("generateOccurrenceDates — cenário completo do pedido (Regra 46)", () => {
  it("generates the exact 10 dates for a 15-day recurrence starting 20/09/2026", () => {
    const start = new Date(Date.UTC(2026, 8, 20));
    const results = generateOccurrenceDates({
      startDate: start,
      frequencyUnit: "DAYS",
      intervalValue: 15,
      occurrencesLimit: 10,
    });
    const dates = results.map((r) => iso(r.date));
    expect(dates).toEqual([
      "2026-09-20",
      "2026-10-05",
      "2026-10-20",
      "2026-11-04",
      "2026-11-19",
      "2026-12-04",
      "2026-12-19",
      "2027-01-03",
      "2027-01-18",
      "2027-02-02",
    ]);
    expect(results.map((r) => r.occurrenceIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("generateOccurrenceDates — all required frequencies", () => {
  const start = new Date(Date.UTC(2026, 0, 5)); // 05/01/2026

  it("weekly", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "WEEKS", intervalValue: 1, occurrencesLimit: 3 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
  });

  it("every 7 days (numerically same as weekly, distinct preset)", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 7, occurrencesLimit: 3 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
  });

  it("every 14 days", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 14, occurrencesLimit: 2 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-01-19"]);
  });

  it("every 21 days", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 21, occurrencesLimit: 2 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-01-26"]);
  });

  it("every 30 days uses a real 30-day interval, not calendar months", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 30, occurrencesLimit: 2 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-02-04"]);
  });

  it("monthly ('uma vez por mês') uses calendar-day rule, distinct from every-30-days", () => {
    const monthlyStart = new Date(Date.UTC(2026, 0, 31)); // 31/01/2026
    const r = generateOccurrenceDates({ startDate: monthlyStart, frequencyUnit: "MONTHS", intervalValue: 1, occurrencesLimit: 4 });
    // 31/01, 28/02 (clamp), 31/03, 30/04 (clamp) — nunca 02/03 como "+30 dias" daria a partir de 31/01+28.
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("custom interval in days", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 40, occurrencesLimit: 2 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-02-14"]);
  });

  it("custom interval in weeks", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "WEEKS", intervalValue: 3, occurrencesLimit: 2 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-01-26"]);
  });

  it("custom interval in months", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "MONTHS", intervalValue: 2, occurrencesLimit: 2 });
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-05", "2026-03-05"]);
  });
});

describe("generateOccurrenceDates — end conditions (Regra 10)", () => {
  const start = new Date(Date.UTC(2026, 0, 1));

  it("stops at occurrencesLimit when no endDate is set", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 10, occurrencesLimit: 5 });
    expect(r).toHaveLength(5);
  });

  it("stops at endDate when no occurrencesLimit is set", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 10, endDate: new Date(Date.UTC(2026, 0, 25)) });
    // 01/01, 11/01, 21/01 — próxima seria 31/01, além do endDate.
    expect(r.map((x) => iso(x.date))).toEqual(["2026-01-01", "2026-01-11", "2026-01-21"]);
  });

  it("uses whichever limit (count or date) is hit first", () => {
    // occurrencesLimit permitiria 10, mas endDate corta antes.
    const rEarlyEndDate = generateOccurrenceDates({
      startDate: start,
      frequencyUnit: "DAYS",
      intervalValue: 10,
      occurrencesLimit: 10,
      endDate: new Date(Date.UTC(2026, 0, 15)),
    });
    expect(rEarlyEndDate).toHaveLength(2); // 01/01, 11/01

    // endDate distante, mas occurrencesLimit corta antes.
    const rEarlyCount = generateOccurrenceDates({
      startDate: start,
      frequencyUnit: "DAYS",
      intervalValue: 10,
      occurrencesLimit: 2,
      endDate: new Date(Date.UTC(2027, 0, 1)),
    });
    expect(rEarlyCount).toHaveLength(2);
  });

  it("generates indefinitely (up to the safety cap) when neither limit nor endDate is set — used only with horizonDate in practice", () => {
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 1, maxCount: 5 });
    expect(r).toHaveLength(5);
  });
});

describe("generateOccurrenceDates — progressive generation (Regra 28/29)", () => {
  it("respects horizonDate for open-ended series", () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const horizon = new Date(Date.UTC(2026, 3, 1)); // 01/04/2026 (~3 meses)
    const r = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 15, horizonDate: horizon });
    for (const { date } of r) {
      expect(date.getTime()).toBeLessThanOrEqual(horizon.getTime());
    }
    expect(r.length).toBeGreaterThan(0);
  });

  it("continues from startIndex without regenerating earlier occurrences (idempotent progressive batches)", () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const firstBatch = generateOccurrenceDates({ startDate: start, frequencyUnit: "DAYS", intervalValue: 10, occurrencesLimit: 5 });
    const nextBatch = generateOccurrenceDates({
      startDate: start,
      frequencyUnit: "DAYS",
      intervalValue: 10,
      startIndex: firstBatch.length,
      occurrencesLimit: 8,
    });
    expect(nextBatch.map((x) => x.occurrenceIndex)).toEqual([5, 6, 7]);
    // occurrenceIndex 5 with a 10-day interval from 01/01/2026 => 01/01 + 50 days.
    expect(iso(nextBatch[0].date)).toBe("2026-02-20");
  });
});

describe("describeFrequency", () => {
  it("uses the preset label when it matches exactly", () => {
    expect(describeFrequency("DAYS", 15)).toBe("A cada 15 dias");
    expect(describeFrequency("WEEKS", 1)).toBe("Toda semana");
    expect(describeFrequency("MONTHS", 1)).toBe("Uma vez por mês");
  });

  it("falls back to a generic description for custom intervals", () => {
    expect(describeFrequency("DAYS", 40)).toBe("A cada 40 dias");
    expect(describeFrequency("WEEKS", 3)).toBe("A cada 3 semanas");
    expect(describeFrequency("MONTHS", 2)).toBe("A cada 2 meses");
  });

  it("every preset resolves to a non-empty label", () => {
    for (const preset of RECURRING_FREQUENCY_PRESETS) {
      expect(describeFrequency(preset.unit, preset.interval)).toBe(preset.label);
    }
  });
});
