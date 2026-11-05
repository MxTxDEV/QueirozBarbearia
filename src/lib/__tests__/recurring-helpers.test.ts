import { describe, it, expect } from "vitest";
import {
  addUtcDays,
  addUtcMonthsClamped,
  addUtcWeeks,
  nthOccurrenceDate,
  generateOccurrenceDates,
  firstIndexAfter,
  buildSeriesDates,
  parseDateList,
  twoYearsLastDay,
  describeSeries,
  MAX_SERIES_DATES,
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

const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("firstIndexAfter — ponto de partida da geração progressiva", () => {
  const FREQS = [
    { unit: "WEEKS", interval: 1 },
    { unit: "DAYS", interval: 7 },
    { unit: "DAYS", interval: 14 },
    { unit: "DAYS", interval: 15 },
    { unit: "DAYS", interval: 21 },
    { unit: "DAYS", interval: 30 },
    { unit: "WEEKS", interval: 2 },
    { unit: "MONTHS", interval: 1 },
    { unit: "MONTHS", interval: 2 },
  ] as const;
  // inclui início no dia 31 (meses curtos), 29/02 em ano bissexto e virada de ano
  const STARTS = [D(2026, 11, 13), D(2026, 12, 31), D(2027, 1, 31), D(2028, 2, 29), D(2026, 10, 14)];

  it("depois da n-ésima data, o próximo índice é n+1 (para todas as frequências)", () => {
    for (const start of STARTS) {
      for (const { unit, interval } of FREQS) {
        for (let n = 0; n < 30; n++) {
          const at = nthOccurrenceDate(start, unit, interval, n);
          expect(firstIndexAfter(start, unit, interval, at), `${iso(start)} ${unit}/${interval} n=${n}`).toBe(n + 1);
        }
      }
    }
  });

  it("uma data entre duas ocorrências aponta para a seguinte", () => {
    for (const start of STARTS) {
      for (const { unit, interval } of FREQS) {
        for (let n = 0; n < 20; n++) {
          const a = nthOccurrenceDate(start, unit, interval, n);
          const b = nthOccurrenceDate(start, unit, interval, n + 1);
          const mid = new Date((a.getTime() + b.getTime()) / 2);
          expect(firstIndexAfter(start, unit, interval, mid), `${iso(start)} ${unit}/${interval} n=${n}`).toBe(n + 1);
        }
      }
    }
  });

  it("antes do início da série, começa do zero", () => {
    expect(firstIndexAfter(D(2026, 11, 13), "WEEKS", 1, D(2026, 11, 1))).toBe(0);
  });

  it("caso real: semanal de sexta — depois de 15/01/2027 a próxima é 22/01", () => {
    const start = D(2026, 11, 13);
    const idx = firstIndexAfter(start, "WEEKS", 1, D(2027, 1, 15));
    expect(iso(nthOccurrenceDate(start, "WEEKS", 1, idx))).toBe("2027-01-22");
  });

  it("caso real: de 14 em 14 dias — depois de 27/01/2027 a próxima é 10/02", () => {
    const start = D(2026, 11, 18); // quarta — 27/01/2027 cai na grade de 14 em 14 dias
    expect(iso(nthOccurrenceDate(start, "DAYS", 14, 5))).toBe("2027-01-27");
    const idx = firstIndexAfter(start, "DAYS", 14, D(2027, 1, 27));
    expect(iso(nthOccurrenceDate(start, "DAYS", 14, idx))).toBe("2027-02-10");
  });
});

describe("geração progressiva sem pular nem repetir datas", () => {
  it("lotes sucessivos (cursor = última data) reproduzem exatamente a série inteira, mesmo com linhas extras", () => {
    for (const { unit, interval } of [
      { unit: "WEEKS", interval: 1 },
      { unit: "DAYS", interval: 14 },
      { unit: "DAYS", interval: 15 },
      { unit: "MONTHS", interval: 1 },
    ] as const) {
      const start = D(2026, 11, 13);
      const all = generateOccurrenceDates({ startDate: start, frequencyUnit: unit, intervalValue: interval, occurrencesLimit: 40 }).map((r) => iso(r.date));
      // primeiro lote (criação): até start + 3 meses; depois, lotes de 3 em 3 meses a partir do cursor
      let cursor: Date | null = null;
      const got: string[] = [];
      for (let horizonMonths = 3; horizonMonths <= 60 && got.length < 40; horizonMonths += 3) {
        const horizon = new Date(start.getTime());
        horizon.setUTCMonth(horizon.getUTCMonth() + horizonMonths);
        const startIndex: number = cursor ? firstIndexAfter(start, unit, interval, cursor) : 0;
        const batch = generateOccurrenceDates({ startDate: start, frequencyUnit: unit, intervalValue: interval, startIndex, horizonDate: horizon });
        for (const b of batch) got.push(iso(b.date));
        if (batch.length) cursor = batch[batch.length - 1].date;
      }
      expect(got.slice(0, 40)).toEqual(all);
    }
  });
});

describe("recorrência por 2 anos (não infinita)", () => {
  it("último dia = exatamente 2 anos depois do início (exclusive)", () => {
    expect(iso(twoYearsLastDay(D(2026, 11, 13)))).toBe("2028-11-12");
    expect(iso(twoYearsLastDay(D(2026, 2, 28)))).toBe("2028-02-27");
    expect(iso(twoYearsLastDay(D(2026, 1, 31)))).toBe("2028-01-30");
  });
  it("semanal: 105 datas (as duas pontas dos 104 intervalos), da 1ª à última semana dos 2 anos", () => {
    const { dates, truncated } = buildSeriesDates({ startDate: D(2026, 11, 13), frequencyUnit: "WEEKS", intervalValue: 1, end: { mode: "twoYears" } });
    expect(truncated).toBe(false);
    expect(dates).toHaveLength(105);
    expect(iso(dates[0])).toBe("2026-11-13");
    expect(iso(dates[104])).toBe("2028-11-10");
  });
  it("a cada 14 e a cada 15 dias: sem passar de 2 anos", () => {
    for (const interval of [14, 15]) {
      const { dates } = buildSeriesDates({ startDate: D(2026, 11, 18), frequencyUnit: "DAYS", intervalValue: interval, end: { mode: "twoYears" } });
      const last = iso(dates[dates.length - 1]);
      expect(last <= "2028-11-17").toBe(true);
      expect(iso(nthOccurrenceDate(D(2026, 11, 18), "DAYS", interval, dates.length)) > "2028-11-17").toBe(true);
      for (let i = 1; i < dates.length; i++) expect((dates[i].getTime() - dates[i - 1].getTime()) / 86400000).toBe(interval);
    }
  });
  it("mensal: 24 datas, dia 31 volta ao 31 quando o mês tem", () => {
    const { dates } = buildSeriesDates({ startDate: D(2026, 12, 31), frequencyUnit: "MONTHS", intervalValue: 1, end: { mode: "twoYears" } });
    expect(dates).toHaveLength(24);
    expect(iso(dates[2])).toBe("2027-02-28");
    expect(iso(dates[3])).toBe("2027-03-31");
  });
  it("intervalo muito curto passa do máximo e avisa (truncated)", () => {
    const r = buildSeriesDates({ startDate: D(2026, 11, 13), frequencyUnit: "DAYS", intervalValue: 1, end: { mode: "twoYears" } });
    expect(r.truncated).toBe(true);
    expect(r.dates).toHaveLength(MAX_SERIES_DATES);
  });
  it("por quantidade e por data final", () => {
    expect(buildSeriesDates({ startDate: D(2026, 11, 13), frequencyUnit: "WEEKS", intervalValue: 2, end: { mode: "count", count: 5 } }).dates).toHaveLength(5);
    const byDate = buildSeriesDates({ startDate: D(2026, 11, 13), frequencyUnit: "DAYS", intervalValue: 14, end: { mode: "date", endDate: D(2027, 1, 31) } });
    expect(iso(byDate.dates[byDate.dates.length - 1])).toBe("2027-01-22"); // 13/11 + 14×6; a próxima (05/02) passa de 31/01
  });
});

describe("parseDateList — datas escolhidas à mão", () => {
  const today = D(2026, 11, 5);
  it("ordena, tira repetidas e devolve datas", () => {
    const r = parseDateList(["2026-12-10", "2026-11-20", "2026-12-10"], today);
    expect(r.ok && r.dates.map(iso)).toEqual(["2026-11-20", "2026-12-10"]);
  });
  it("recusa formato inválido, data inexistente, passado e lista vazia", () => {
    expect(parseDateList(["10/12/2026"], today).ok).toBe(false);
    expect(parseDateList(["2026-02-31"], today).ok).toBe(false);
    expect(parseDateList(["2026-11-04"], today).ok).toBe(false);
    expect(parseDateList([], today).ok).toBe(false);
  });
  it("hoje é válido", () => expect(parseDateList(["2026-11-05"], today).ok).toBe(true));
  it("passa de 200 datas: recusa", () => {
    const many = Array.from({ length: MAX_SERIES_DATES + 1 }, (_, i) => iso(addUtcDays(D(2026, 11, 6), i)));
    expect(parseDateList(many, today).ok).toBe(false);
  });
});

describe("describeSeries", () => {
  it("datas escolhidas à mão", () => expect(describeSeries({ frequencyUnit: "DAYS", intervalValue: 1, manualDates: true })).toBe("Datas escolhidas"));
  it("segue a frequência quando não é manual", () => expect(describeSeries({ frequencyUnit: "DAYS", intervalValue: 14, manualDates: false })).toBe("A cada 14 dias"));
});
