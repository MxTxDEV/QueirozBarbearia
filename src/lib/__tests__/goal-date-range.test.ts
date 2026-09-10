import { describe, it, expect } from "vitest";
import { endOfGoalDay } from "@/lib/goal-date-range";

describe("endOfGoalDay", () => {
  it("returns the start of the next day, exclusive of the goal's last day", () => {
    const endDate = new Date("2026-09-10T00:00:00.000Z");
    expect(endOfGoalDay(endDate).toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });

  it("keeps a same-day transaction inside the exclusive bound (the bug this fixes)", () => {
    const endDate = new Date("2026-09-10T00:00:00.000Z");
    const saleAtEndOfDay = new Date("2026-09-10T23:59:59.000Z");
    expect(saleAtEndOfDay.getTime()).toBeLessThan(endOfGoalDay(endDate).getTime());
    // O bug original comparava `<= endDate`, que exclui qualquer horário após a meia-noite do último dia.
    expect(saleAtEndOfDay.getTime()).toBeGreaterThan(endDate.getTime());
  });

  it("excludes a transaction from the day after the goal ends", () => {
    const endDate = new Date("2026-09-10T00:00:00.000Z");
    const nextDaySale = new Date("2026-09-11T00:00:00.001Z");
    expect(nextDaySale.getTime()).toBeGreaterThanOrEqual(endOfGoalDay(endDate).getTime());
  });
});
