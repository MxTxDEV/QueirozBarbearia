import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMER_SLOTS,
  customerSlotExamples,
  firstGridMinute,
  hhmmToMin,
  isOnCustomerGrid,
  isValidHHMM,
  normalizeCustomerSlotConfig,
} from "../customer-slots";

const cfg = (stepMin: number, startHHMM: string | null = null) => ({ stepMin, startHHMM });

describe("normalizeCustomerSlotConfig", () => {
  it("sem nada salvo: 45 min, início do expediente", () => expect(normalizeCustomerSlotConfig(undefined, undefined)).toEqual(DEFAULT_CUSTOMER_SLOTS));
  it("aceita texto numérico e hora válida", () => expect(normalizeCustomerSlotConfig("30", "09:00")).toEqual({ stepMin: 30, startHHMM: "09:00" }));
  it("valor fora do limite ou quebrado volta ao padrão", () => {
    for (const bad of ["4", "241", "abc", "", "30.5", NaN, null, 0, -15]) expect(normalizeCustomerSlotConfig(bad, null).stepMin).toBe(45);
    expect(normalizeCustomerSlotConfig(5, null).stepMin).toBe(5);
    expect(normalizeCustomerSlotConfig(240, null).stepMin).toBe(240);
  });
  it("hora inválida vira 'início do expediente'", () => {
    for (const bad of ["24:00", "9:00", "09:60", "abc", "", null, 900]) expect(normalizeCustomerSlotConfig(45, bad).startHHMM).toBeNull();
  });
});

describe("isValidHHMM / hhmmToMin", () => {
  it("valida", () => {
    expect(isValidHHMM("00:00")).toBe(true);
    expect(isValidHHMM("23:59")).toBe(true);
    expect(isValidHHMM("24:00")).toBe(false);
  });
  it("converte", () => expect(hhmmToMin("08:45")).toBe(525));
});

describe("grade de 45 em 45 minutos", () => {
  const day = hhmmToMin("08:00");
  it("sem hora de início: conta a partir da abertura do barbeiro", () => {
    expect(customerSlotExamples(cfg(45), "08:00", 5)).toEqual(["08:00", "08:45", "09:30", "10:15", "11:00"]);
    expect(isOnCustomerGrid(hhmmToMin("09:30"), day, cfg(45))).toBe(true);
    expect(isOnCustomerGrid(hhmmToMin("09:00"), day, cfg(45))).toBe(false);
  });
  it("cada barbeiro conta a partir da própria abertura", () => {
    const nine = hhmmToMin("09:00");
    expect(isOnCustomerGrid(hhmmToMin("09:45"), nine, cfg(45))).toBe(true);
    expect(isOnCustomerGrid(hhmmToMin("09:30"), nine, cfg(45))).toBe(false);
  });
  it("com hora de início: começa nela e não oferece nada antes", () => {
    const c = cfg(45, "09:00");
    expect(customerSlotExamples(c, "08:00", 4)).toEqual(["09:00", "09:45", "10:30", "11:15"]);
    expect(isOnCustomerGrid(hhmmToMin("09:00"), day, c)).toBe(true);
    expect(isOnCustomerGrid(hhmmToMin("08:15"), day, c)).toBe(false); // antes do início da contagem
    expect(isOnCustomerGrid(hhmmToMin("08:00"), day, c)).toBe(false);
  });
  it("início da contagem ANTES da abertura: segue a mesma sequência até cair no expediente", () => {
    const c = cfg(45, "08:00");
    const nine = hhmmToMin("09:00");
    expect(firstGridMinute(c, nine)).toBe(hhmmToMin("09:30")); // 08:00, 08:45, 09:30
    expect(isOnCustomerGrid(hhmmToMin("09:30"), nine, c)).toBe(true);
    expect(isOnCustomerGrid(hhmmToMin("09:00"), nine, c)).toBe(false);
  });
  it("início exatamente na abertura", () => expect(firstGridMinute(cfg(45, "08:00"), hhmmToMin("08:00"))).toBe(hhmmToMin("08:00")));
  it("outros intervalos, inclusive os que não são múltiplos de 15", () => {
    expect(customerSlotExamples(cfg(20), "08:00", 4)).toEqual(["08:00", "08:20", "08:40", "09:00"]);
    expect(customerSlotExamples(cfg(50), "08:00", 4)).toEqual(["08:00", "08:50", "09:40", "10:30"]);
    expect(customerSlotExamples(cfg(60), "08:00", 3)).toEqual(["08:00", "09:00", "10:00"]);
    expect(isOnCustomerGrid(hhmmToMin("08:50"), day, cfg(50))).toBe(true);
  });
  it("a prévia nunca passa da meia-noite", () => {
    const list = customerSlotExamples(cfg(240, "20:00"), "08:00", 10);
    expect(list).toEqual(["20:00"]);
  });
});
