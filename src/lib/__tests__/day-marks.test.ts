import { describe, expect, it } from "vitest";
import { appliesToBarber, closuresFor, dominantKind, hasWindow, markKindForAppointment, markReason, validateMarkWindow } from "../day-marks";

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
    expect(forB1.windows).toEqual([{ start: 840, end: 990, reason: "Fora de expediente — Evento (14:00–16:30)", kind: "OUT_OF_HOURS" }]);
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

describe("markKindForAppointment", () => {
  const at = (barberId: string, startMin: number, endMin: number) => ({ barberId, startMin, endMin });
  it("sem marcas, nada pinta", () => {
    expect(markKindForAppointment([], at("b1", 600, 630))).toBeNull();
    expect(markKindForAppointment(undefined, at("b1", 600, 630))).toBeNull();
  });
  it("marca do dia todo pinta todos os agendamentos; de um barbeiro, só os dele", () => {
    expect(markKindForAppointment([mark()], at("b1", 600, 630))).toBe("HOLIDAY");
    expect(markKindForAppointment([mark({ kind: "DAY_OFF", barberId: "b2" })], at("b1", 600, 630))).toBeNull();
    expect(markKindForAppointment([mark({ kind: "DAY_OFF", barberId: "b2" })], at("b2", 600, 630))).toBe("DAY_OFF");
  });
  it("marca com horário só pinta quem encosta na janela", () => {
    const window = [mark({ kind: "OUT_OF_HOURS", startTime: "14:00", endTime: "16:00" })];
    expect(markKindForAppointment(window, at("b1", 13 * 60, 14 * 60))).toBeNull();
    expect(markKindForAppointment(window, at("b1", 13 * 60 + 30, 14 * 60 + 15))).toBe("OUT_OF_HOURS");
    expect(markKindForAppointment(window, at("b1", 16 * 60, 16 * 60 + 30))).toBeNull();
  });
  it("feriado vence folga e fora de expediente", () => {
    expect(markKindForAppointment([mark({ kind: "DAY_OFF" }), mark({ kind: "HOLIDAY" })], at("b1", 600, 630))).toBe("HOLIDAY");
  });
});
