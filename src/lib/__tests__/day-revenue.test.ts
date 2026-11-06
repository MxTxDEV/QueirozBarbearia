import { describe, expect, it } from "vitest";
import { sumDayRevenue } from "../day-revenue";

describe("sumDayRevenue", () => {
  it("soma só o que já foi pago; ignora não pagos, cancelados e faltas", () => {
    const r = sumDayRevenue([
      { status: "COMPLETED", paid: 45 },
      { status: "COMPLETED", paid: 30.5 },
      { status: "CONFIRMED" },
      { status: "PENDING", paid: null },
      { status: "CANCELLED", paid: 100 },
      { status: "NO_SHOW", paid: 50 },
    ]);
    expect(r).toEqual({ received: 75.5, count: 2 });
  });
  it("dia vazio", () => {
    expect(sumDayRevenue([])).toEqual({ received: 0, count: 0 });
  });
});
