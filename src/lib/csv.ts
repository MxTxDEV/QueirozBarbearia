/** Escapa um valor para uma célula CSV (RFC 4180): aspas duplicadas, campo entre aspas se tiver vírgula/aspas/quebra de linha. */
function csvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function csvRow(fields: (string | number)[]): string {
  return fields.map(csvCell).join(",") + "\r\n";
}

/** BOM UTF-8 — sem isso o Excel abre acentos (ção, é, ã) como caracteres errados. */
export const CSV_BOM = "﻿";
