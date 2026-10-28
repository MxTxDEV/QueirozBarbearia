/**
 * Textos de forma de pagamento — parte PURA (sem banco), testável.
 */

/** Nome curto de cada forma, para listas e resumos. */
export const PAYMENT_METHOD_SHORT: Record<string, string> = {
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  PIX: "Pix",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

/** "Pago no débito", "Pago no crédito", "Pago no Pix", "Pago em dinheiro". */
const PAID_PHRASE: Record<string, string> = {
  DEBIT_CARD: "Pago no débito",
  CREDIT_CARD: "Pago no crédito",
  PIX: "Pago no Pix",
  CASH: "Pago em dinheiro",
  OTHER: "Pago",
};

const PAID_SHORT: Record<string, string> = {
  DEBIT_CARD: "débito",
  CREDIT_CARD: "crédito",
  PIX: "Pix",
  CASH: "dinheiro",
};

/**
 * Selo do atendimento já pago: a forma usada. Mais de uma forma (pagamento dividido):
 * "Pago: Pix + dinheiro". Sem forma conhecida: só "Pago".
 */
export function paidLabel(methods: readonly string[]): string {
  const unique = [...new Set(methods)];
  if (unique.length === 0) return "Pago";
  if (unique.length === 1) return PAID_PHRASE[unique[0]] ?? "Pago";
  const names = unique.map((m) => PAID_SHORT[m]).filter(Boolean);
  return names.length > 0 ? `Pago: ${names.join(" + ")}` : "Pago";
}
