import { describe, expect, it } from "vitest";
import { breakdownByMethod, type IncomeRow } from "../payment-breakdown";
import { paidLabel } from "../payment-labels";

const row = (method: string | null, amount: number, clientKey: string, clientName = clientKey): IncomeRow => ({ method, amount, clientKey, clientName });

describe("paidLabel", () => {
  it("uma forma só", () => {
    expect(paidLabel(["DEBIT_CARD"])).toBe("Pago no débito");
    expect(paidLabel(["CREDIT_CARD"])).toBe("Pago no crédito");
    expect(paidLabel(["PIX"])).toBe("Pago no Pix");
    expect(paidLabel(["CASH"])).toBe("Pago em dinheiro");
    expect(paidLabel(["OTHER"])).toBe("Pago");
  });
  it("pagamento dividido em mais de uma forma", () => {
    expect(paidLabel(["PIX", "CASH"])).toBe("Pago: Pix + dinheiro");
    expect(paidLabel(["PIX", "PIX", "CASH"])).toBe("Pago: Pix + dinheiro");
  });
  it("sem forma informada", () => expect(paidLabel([])).toBe("Pago"));
});

describe("breakdownByMethod", () => {
  it("separa total e clientes por forma de pagamento", () => {
    const { total, methods } = breakdownByMethod([
      row("DEBIT_CARD", 45, "a", "Ana"),
      row("DEBIT_CARD", 55, "b", "Bruno"),
      row("PIX", 20, "a", "Ana"),
      row("CASH", 35, "c", "Caio"),
      row("CREDIT_CARD", 80, "b", "Bruno"),
    ]);
    const by = Object.fromEntries(methods.map((m) => [m.method, m]));
    expect(total).toBe(235);
    expect(by.DEBIT_CARD.total).toBe(100);
    expect(by.DEBIT_CARD.count).toBe(2);
    expect(by.DEBIT_CARD.clients.map((c) => c.name)).toEqual(["Bruno", "Ana"]);
    expect(by.PIX.total).toBe(20);
    expect(by.CASH.total).toBe(35);
    expect(by.CREDIT_CARD.total).toBe(80);
    expect(methods.reduce((s, m) => s + m.total, 0)).toBe(total);
  });
  it("junta o mesmo cliente que pagou mais de uma vez na mesma forma", () => {
    const { methods } = breakdownByMethod([row("PIX", 20, "a", "Ana"), row("PIX", 25.5, "a", "Ana")]);
    const pix = methods.find((m) => m.method === "PIX")!;
    expect(pix.clients).toEqual([{ name: "Ana", total: 45.5, count: 2 }]);
    expect(pix.count).toBe(2);
  });
  it("as quatro formas principais aparecem sempre; 'Outro' e 'sem forma' só quando há valor", () => {
    expect(breakdownByMethod([]).methods.map((m) => m.method)).toEqual(["DEBIT_CARD", "CREDIT_CARD", "PIX", "CASH"]);
    const withExtras = breakdownByMethod([row("OTHER", 10, "x"), row(null, 5, "y")]);
    expect(withExtras.methods.map((m) => m.method)).toEqual(["DEBIT_CARD", "CREDIT_CARD", "PIX", "CASH", "OTHER", "NONE"]);
    expect(withExtras.total).toBe(15);
  });
  it("soma em centavos: sem erro de ponto flutuante", () => {
    const rows = Array.from({ length: 10 }, () => row("PIX", 0.1, "a"));
    expect(breakdownByMethod(rows).total).toBe(1);
    expect(breakdownByMethod([row("PIX", 0.1, "a"), row("PIX", 0.2, "b")]).methods.find((m) => m.method === "PIX")!.total).toBe(0.3);
  });
  it("participação em % soma 100 quando há entradas", () => {
    const { methods } = breakdownByMethod([row("PIX", 75, "a"), row("CASH", 25, "b")]);
    expect(methods.find((m) => m.method === "PIX")!.share).toBe(75);
    expect(methods.reduce((s, m) => s + m.share, 0)).toBeCloseTo(100);
  });
  it("sem entradas: participação zero", () => {
    expect(breakdownByMethod([]).methods.every((m) => m.share === 0 && m.total === 0)).toBe(true);
  });
});
