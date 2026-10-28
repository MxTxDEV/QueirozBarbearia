import { PAYMENT_METHOD_SHORT } from "./payment-labels";

/**
 * Entradas do período separadas por forma de pagamento — parte PURA (sem banco), testável.
 * Valores somados em centavos (inteiros) para o total nunca "andar" por arredondamento de decimal.
 */

export type IncomeRow = {
  /** null = entrada antiga/sem forma de pagamento informada. */
  method: string | null;
  amount: number;
  /** Quem pagou (cliente cadastrado, avulso ou, na falta, a descrição do lançamento). */
  clientKey: string;
  clientName: string;
};

export type MethodClient = { name: string; total: number; count: number };
export type MethodBreakdown = {
  /** DEBIT_CARD | CREDIT_CARD | PIX | CASH | OTHER | NONE (sem forma informada). */
  method: string;
  label: string;
  total: number;
  count: number;
  /** % do total de entradas (0–100). */
  share: number;
  clients: MethodClient[];
};

/** Ordem de exibição; as quatro primeiras aparecem sempre (mesmo zeradas), as outras só se houver valor. */
const ORDER = ["DEBIT_CARD", "CREDIT_CARD", "PIX", "CASH", "OTHER", "NONE"] as const;
const ALWAYS = new Set(["DEBIT_CARD", "CREDIT_CARD", "PIX", "CASH"]);

const toCents = (value: number) => Math.round(value * 100);

export function breakdownByMethod(rows: IncomeRow[]): { total: number; methods: MethodBreakdown[] } {
  const byMethod = new Map<string, { cents: number; count: number; clients: Map<string, { name: string; cents: number; count: number }> }>();
  let totalCents = 0;

  for (const row of rows) {
    const key = row.method && row.method in PAYMENT_METHOD_SHORT ? row.method : "NONE";
    const cents = toCents(row.amount);
    totalCents += cents;
    const entry = byMethod.get(key) ?? { cents: 0, count: 0, clients: new Map() };
    entry.cents += cents;
    entry.count += 1;
    const client = entry.clients.get(row.clientKey) ?? { name: row.clientName, cents: 0, count: 0 };
    client.cents += cents;
    client.count += 1;
    entry.clients.set(row.clientKey, client);
    byMethod.set(key, entry);
  }

  const methods: MethodBreakdown[] = [];
  for (const method of ORDER) {
    const entry = byMethod.get(method);
    if (!entry && !ALWAYS.has(method)) continue;
    const cents = entry?.cents ?? 0;
    methods.push({
      method,
      label: method === "NONE" ? "Sem forma informada" : PAYMENT_METHOD_SHORT[method],
      total: cents / 100,
      count: entry?.count ?? 0,
      share: totalCents > 0 ? (cents / totalCents) * 100 : 0,
      clients: [...(entry?.clients.values() ?? [])]
        .map((c) => ({ name: c.name, total: c.cents / 100, count: c.count }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR")),
    });
  }
  return { total: totalCents / 100, methods };
}
