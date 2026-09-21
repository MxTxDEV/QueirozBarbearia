import * as XLSX from "xlsx";

/**
 * Importação de clientes a partir de planilha (.xlsx/.xls/.csv) — pensada
 * pra migração de sistemas antigos de barbearia/salão, que costumam
 * exportar colunas em português com nomes variados. Por isso o casamento de
 * coluna é por uma lista de apelidos, não por um nome fixo — assim a mesma
 * tela serve pra outra planilha com cabeçalhos um pouco diferentes.
 */

export type ParsedCustomerRow = {
  rowNumber: number;
  fullName: string;
  whatsappRaw: string;
  email?: string;
  birthDate?: Date;
  cpf?: string;
};

export type ParsedRowError = { rowNumber: number; reason: string };

export type ParsedCustomerWorkbook = {
  rows: ParsedCustomerRow[];
  errors: ParsedRowError[];
};

const COLUMN_ALIASES = {
  fullName: ["nome", "nome completo", "cliente", "name"],
  whatsapp: ["celular", "whatsapp", "whats", "telefone celular", "phone"],
  whatsappFallback: ["telefone", "telefone fixo"],
  email: ["email", "e-mail"],
  birthDate: ["nascimento", "data de nascimento", "aniversario", "aniversário", "birthdate", "data nascimento"],
  cpf: ["cpf"],
} as const;

function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function findColumn(headers: string[], aliases: readonly string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((h) => normalizedAliases.includes(h));
}

/** Aceita Date (célula formatada como data), número de série do Excel, ou texto "DD/MM/AAAA". */
export function parseBrazilianDate(raw: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
  }

  if (typeof raw === "number") {
    // Número de série de data do Excel (dias desde 1899-12-30).
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return undefined;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const text = String(raw).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejeita datas "estouradas" (ex: 31/02) que o UTC.Date acabaria rolando pro mês seguinte.
  if (date.getUTCMonth() !== month - 1) return undefined;
  return date;
}

/**
 * Lê a primeira planilha do arquivo e devolve as linhas já mapeadas pros
 * campos do Customer, mais uma lista de erros de linha (nome ou telefone
 * ausente) — pra a tela de importação mostrar exatamente o que precisa de
 * atenção manual, sem abortar o restante do arquivo por causa de uma linha.
 */
export function parseCustomerWorkbook(buffer: ArrayBuffer | Buffer): ParsedCustomerWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [] };

  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  if (raw.length === 0) return { rows: [], errors: [] };

  const headers = (raw[0] as unknown[]).map(normalizeHeader);
  const col = {
    fullName: findColumn(headers, COLUMN_ALIASES.fullName),
    whatsapp: findColumn(headers, COLUMN_ALIASES.whatsapp),
    whatsappFallback: findColumn(headers, COLUMN_ALIASES.whatsappFallback),
    email: findColumn(headers, COLUMN_ALIASES.email),
    birthDate: findColumn(headers, COLUMN_ALIASES.birthDate),
    cpf: findColumn(headers, COLUMN_ALIASES.cpf),
  };

  if (col.fullName === -1 || (col.whatsapp === -1 && col.whatsappFallback === -1)) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          reason:
            "Não encontrei as colunas de nome e telefone no arquivo. Verifique se a primeira linha tem os cabeçalhos (ex: Nome, Celular).",
        },
      ],
    };
  }

  const rows: ParsedCustomerRow[] = [];
  const errors: ParsedRowError[] = [];

  for (let i = 1; i < raw.length; i++) {
    const line = raw[i] as unknown[];
    if (!line || line.every((cell) => cell == null || cell === "")) continue;
    const rowNumber = i + 1; // 1-based, contando a linha de cabeçalho

    const fullName = String(line[col.fullName] ?? "").trim();
    const whatsappRaw = String((col.whatsapp !== -1 ? line[col.whatsapp] : undefined) ?? (col.whatsappFallback !== -1 ? line[col.whatsappFallback] : undefined) ?? "").trim();

    if (!fullName) {
      errors.push({ rowNumber, reason: "Nome em branco." });
      continue;
    }
    if (!whatsappRaw) {
      errors.push({ rowNumber, reason: `Cliente "${fullName}" sem telefone.` });
      continue;
    }

    const emailRaw = col.email !== -1 ? String(line[col.email] ?? "").trim() : "";
    const cpfRaw = col.cpf !== -1 ? String(line[col.cpf] ?? "").trim() : "";

    rows.push({
      rowNumber,
      fullName,
      whatsappRaw,
      email: emailRaw && emailRaw.includes("@") ? emailRaw : undefined,
      birthDate: col.birthDate !== -1 ? parseBrazilianDate(line[col.birthDate]) : undefined,
      cpf: cpfRaw || undefined,
    });
  }

  return { rows, errors };
}
