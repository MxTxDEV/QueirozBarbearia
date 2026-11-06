/** Agendamentos cancelados ou com falta não entram no faturamento do dia. */
const NOT_REVENUE = new Set(["CANCELLED", "NO_SHOW"]);

export type DayRevenue = {
  /** Faturamento do dia: só o que já foi pago (pagamento confirmado). */
  received: number;
  /** Quantos atendimentos já foram pagos. */
  count: number;
};

export function sumDayRevenue(items: { status: string; paid?: number | null }[]): DayRevenue {
  let received = 0;
  let count = 0;
  for (const item of items) {
    if (NOT_REVENUE.has(item.status) || item.paid == null) continue;
    received += item.paid;
    count++;
  }
  return { received: Math.round(received * 100) / 100, count };
}
