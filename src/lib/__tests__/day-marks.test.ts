import { describe, expect, it } from "vitest";
import { appliesToBarber, closuresFor, dominantKind, hasWindow, markReason, validateMarkWindow } from "../day-marks";

const mark = (over: Partial<Parameters<typeof markReason>[0]> = {}) => ({ kind: "HOLIDAY", barberId: null, title: null, startTime: null, endTime: null, ...over });

describe("day-marks", () => {
  it("markReason", () => {
    expect(markReason(mark())).toBe("Feriado");
    expect(markReason(mark({ title: " Finados " }))).toBe("Feriado — Finados");
    expect(markReason(mark({ kind: "OUT_OF_HOURS", title: "Manutenção", startTime: "14:00", endTime: "18:00" }))).toBe("Fora de expediente — Manutenção (14:00–18:00)");
    expect(markReason(mark({ kind: "DAY_OFF" }))).toBe("Folga");
  });

  it("aplica à barbearia toda ou só ao barbeiro certo", () => {
    expect(appliesToBarber({ barberId: null }, "b1")).toBe(true);
    expect(appliesToBarber({ barberId: "b1" }, "b1")).toBe(true);
    expect(appliesToBarber({ barberId: "b2" }, "b1")).toBe(false);
  });

  it("closuresFor: dia inteiro e janelas, só do barbeiro", () => {
    const marks = [
      mark({ kind: "DAY_OFF", barberId: "b2", title: "Marcos" }),
      mark({ kind: "OUT_OF_HOURS", startTime: "14:00", endTime: "16:30", title: "Evento" }),
    ];
    const forB1 = closuresFor(marks, "b1");
    expect(forB1.wholeDay).toBeNull();
    expect(forB1.windows).toEqual([{ start: 840, end: 990, reason: "Fora de expediente — Evento (14:00–16:30)" }]);
    const forB2 = closuresFor(marks, "b2");
    expect(forB2.wholeDay).toBe("Folga — Marcos");
    expect(closuresFor([mark({ title: "Natal" })], "b1").wholeDay).toBe("Feriado — Natal");
  });

  it("dominantKind e hasWindow", () => {
    expect(dominantKind([{ kind: "OUT_OF_HOURS" }, { kind: "DAY_OFF" }])).toBe("DAY_OFF");
    expect(dominantKind([{ kind: "OUT_OF_HOURS" }, { kind: "HOLIDAY" }, { kind: "DAY_OFF" }])).toBe("HOLIDAY");
    expect(dominantKind([])).toBeNull();
    expect(hasWindow({ startTime: "10:00", endTime: "11:00" })).toBe(true);
    expect(hasWindow({ startTime: null, endTime: null })).toBe(false);
  });

  it("validateMarkWindow", () => {
    expect(validateMarkWindow(null, null)).toBeNull();
    expect(validateMarkWindow("10:00", "12:00")).toBeNull();
    expect(validateMarkWindow("10:00", null)).toContain("início e o fim");
    expect(validateMarkWindow("12:00", "10:00")).toContain("depois do início");
    expect(validateMarkWindow("25:00", "26:00")).toContain("inválido");
  });
});
