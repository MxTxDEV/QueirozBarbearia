import { describe, expect, it } from "vitest";
import { sumDayRevenue } from "../day-revenue";

describe("sumDayRevenue", () => {
  it("usa o valor pago quando já pago e o do serviço quando ainda não; ignora cancelados e faltas", () => {
    const r = sumDayRevenue([
      { status: "COMPLETED", value: 40, paid: 45 },
      { status: "CONFIRMED", value: 35.5 },
      { status: "PENDING", value: 20, paid: null },
      { status: "CANCELLED", value: 100 },
      { status: "NO_SHOW", value: 50 },
    ]);
    expect(r).toEqual({ total: 100.5, received: 45, count: 3 });
  });
  it("dia vazio", () => {
    expect(sumDayRevenue([])).toEqual({ total: 0, received: 0, count: 0 });
  });
});
