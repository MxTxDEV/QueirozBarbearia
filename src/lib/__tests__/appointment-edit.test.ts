import { describe, expect, it } from "vitest";
import { buildEditTimes, isRealDateTime, sameServiceSet, toDateInput, toTimeInput } from "../appointment-edit";

describe("buildEditTimes", () => {
  it("monta início, fim e dia como relógio de parede em UTC", () => {
    const t = buildEditTimes("2026-11-05", "15:30", 45);
    expect(t.startTime.toISOString()).toBe("2026-11-05T15:30:00.000Z");
    expect(t.endTime.toISOString()).toBe("2026-11-05T16:15:00.000Z");
    expect(t.appointmentDate.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(t.sameDay).toBe(true);
  });
  it("detecta atendimento que atravessa a meia-noite", () => {
    expect(buildEditTimes("2026-11-05", "23:30", 60).sameDay).toBe(false);
    expect(buildEditTimes("2026-11-05", "23:00", 60).sameDay).toBe(true);
  });
});

describe("sameServiceSet", () => {
  it("ignora a ordem", () => expect(sameServiceSet(["a", "b"], ["b", "a"])).toBe(true));
  it("detecta diferença", () => {
    expect(sameServiceSet(["a"], ["a", "b"])).toBe(false);
    expect(sameServiceSet(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("toDateInput / toTimeInput", () => {
  it("devolvem o relógio de parede guardado", () => {
    const d = new Date(Date.UTC(2026, 9, 14, 9, 5));
    expect(toDateInput(d)).toBe("2026-10-14");
    expect(toTimeInput(d)).toBe("09:05");
  });
});

describe("isRealDateTime", () => {
  it("recusa data ou hora que não existe", () => {
    expect(isRealDateTime("2026-02-31", "10:00")).toBe(false);
    expect(isRealDateTime("2026-02-28", "24:00")).toBe(false);
    expect(isRealDateTime("2026-02-28", "10:60")).toBe(false);
  });
  it("aceita data e hora reais", () => expect(isRealDateTime("2028-02-29", "23:59")).toBe(true));
});
