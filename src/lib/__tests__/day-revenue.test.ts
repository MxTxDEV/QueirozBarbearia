import { describe, expect, it } from "vitest";
import { sumDayRevenue } from "../day-revenue";

describe("sumDayRevenue", () => {
  it("soma só o que não foi cancelado nem faltou", () => {
    const r = sumDayRevenue([
      { status: "COMPLETED", value: 40 },
      { status: "CONFIRMED", value: 35.5 },
      { status: "PENDING", value: 20 },
      { status: "CANCELLED", value: 100 },
      { status: "NO_SHOW", value: 50 },
    ]);
    expect(r).toEqual({ total: 95.5, done: 40, count: 3 });
  });
  it("dia vazio", () => {
    expect(sumDayRevenue([])).toEqual({ total: 0, done: 0, count: 0 });
  });
});
