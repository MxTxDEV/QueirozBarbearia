import { describe, it, expect } from "vitest";
import { formatCurrency, formatDuration, normalizeWhatsapp, formatWhatsappDisplay, weekdayName } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats a number as BRL", () => {
    expect(formatCurrency(45)).toBe("R$ 45,00");
  });

  it("accepts a numeric string (as stored via Prisma Decimal.toString())", () => {
    expect(formatCurrency("70.5")).toBe("R$ 70,50");
  });
});

describe("formatDuration", () => {
  it("formats minutes-only durations", () => {
    expect(formatDuration(40)).toBe("40min");
  });

  it("formats exact hours with no leftover minutes", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours plus minutes", () => {
    expect(formatDuration(90)).toBe("1h30min");
  });
});

describe("normalizeWhatsapp", () => {
  it("normalizes a local 11-digit number (with 9th digit) to +55 E.164", () => {
    expect(normalizeWhatsapp("31995797674")).toBe("+5531995797674");
  });

  it("normalizes a number already carrying the 55 country code", () => {
    expect(normalizeWhatsapp("5531995797674")).toBe("+5531995797674");
  });

  it("strips formatting characters before validating", () => {
    expect(normalizeWhatsapp("(31) 99579-7674")).toBe("+5531995797674");
  });

  it("rejects a number with too few digits", () => {
    expect(normalizeWhatsapp("123456")).toBeNull();
  });

  it("rejects a number with too many digits", () => {
    expect(normalizeWhatsapp("55319957976744444")).toBeNull();
  });
});

describe("formatWhatsappDisplay", () => {
  it("formats a 9-digit mobile number for display", () => {
    expect(formatWhatsappDisplay("+5531995797674")).toBe("+55 31 99579-7674");
  });

  it("formats an 8-digit landline number for display", () => {
    expect(formatWhatsappDisplay("+553133334444")).toBe("+55 31 3333-4444");
  });
});

describe("weekdayName", () => {
  it("maps 0-6 to Portuguese weekday names", () => {
    expect(weekdayName(0)).toBe("Domingo");
    expect(weekdayName(6)).toBe("Sábado");
  });

  it("returns an empty string for an out-of-range index", () => {
    expect(weekdayName(9)).toBe("");
  });
});
