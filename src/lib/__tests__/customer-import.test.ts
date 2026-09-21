import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseCustomerWorkbook, parseBrazilianDate } from "@/lib/customer-import";

function buildWorkbook(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Clientes");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("parseBrazilianDate", () => {
  it("parses DD/MM/AAAA text", () => {
    const date = parseBrazilianDate("22/06/1987");
    expect(date?.toISOString().slice(0, 10)).toBe("1987-06-22");
  });

  it("parses a JS Date preserving only the calendar day (UTC)", () => {
    const date = parseBrazilianDate(new Date(2020, 0, 15));
    expect(date?.toISOString().slice(0, 10)).toBe("2020-01-15");
  });

  it("rejects an invalid day/month combination", () => {
    expect(parseBrazilianDate("31/02/2020")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(parseBrazilianDate("")).toBeUndefined();
    expect(parseBrazilianDate(null)).toBeUndefined();
  });
});

describe("parseCustomerWorkbook", () => {
  it("maps the exact export columns from the legacy system", () => {
    const buffer = buildWorkbook([
      ["Nome", "CPF", "Email", "DDI", "Celular", "Telefone", "Nascimento"],
      ["Adenilton Rodrigues De Lima", "095.650.116-83", null, 55, "(31) 99914-8578", null, "22/06/1987"],
    ]);
    const { rows, errors } = parseCustomerWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fullName: "Adenilton Rodrigues De Lima",
      whatsappRaw: "(31) 99914-8578",
      cpf: "095.650.116-83",
    });
    expect(rows[0].birthDate?.toISOString().slice(0, 10)).toBe("1987-06-22");
  });

  it("matches columns case-insensitively and without accents", () => {
    const buffer = buildWorkbook([
      ["NOME", "WHATSAPP", "E-MAIL"],
      ["Maria Silva", "31988887777", "maria@example.com"],
    ]);
    const { rows } = parseCustomerWorkbook(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("maria@example.com");
  });

  it("falls back to Telefone when Celular is absent", () => {
    const buffer = buildWorkbook([
      ["Nome", "Telefone"],
      ["João Pedro", "3133334444"],
    ]);
    const { rows } = parseCustomerWorkbook(buffer);
    expect(rows[0].whatsappRaw).toBe("3133334444");
  });

  it("reports a row error instead of throwing when the name is missing", () => {
    const buffer = buildWorkbook([
      ["Nome", "Celular"],
      ["", "31999998888"],
    ]);
    const { rows, errors } = parseCustomerWorkbook(buffer);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/nome/i);
  });

  it("reports a row error instead of throwing when the phone is missing", () => {
    const buffer = buildWorkbook([
      ["Nome", "Celular"],
      ["Cliente Sem Telefone", ""],
    ]);
    const { rows, errors } = parseCustomerWorkbook(buffer);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/telefone/i);
  });

  it("skips fully blank rows silently", () => {
    const buffer = buildWorkbook([
      ["Nome", "Celular"],
      ["Cliente Um", "31999990001"],
      [null, null],
      ["Cliente Dois", "31999990002"],
    ]);
    const { rows, errors } = parseCustomerWorkbook(buffer);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("returns a top-level error when required columns can't be found", () => {
    const buffer = buildWorkbook([
      ["Coluna A", "Coluna B"],
      ["x", "y"],
    ]);
    const { rows, errors } = parseCustomerWorkbook(buffer);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
