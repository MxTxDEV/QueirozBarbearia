/** Agendamentos cancelados ou com falta não entram no faturamento do dia. */
const NOT_REVENUE = new Set(["CANCELLED", "NO_SHOW"]);

export type DayRevenue = {
  /** Previsto do dia: o valor pago quando já foi pago, senão o valor do serviço (cancelados/faltas não entram). */
  total: number;
  /** Já recebido: soma dos pagamentos confirmados. */
  received: number;
  count: number;
};

export function sumDayRevenue(items: { status: string; value: number; paid?: number | null }[]): DayRevenue {
  let total = 0;
  let received = 0;
  let count = 0;
  for (const item of items) {
    if (NOT_REVENUE.has(item.status)) continue;
    count++;
    const paid = item.paid ?? null;
    total += paid ?? item.value;
    if (paid !== null) received += paid;
  }
  return { total: Math.round(total * 100) / 100, received: Math.round(received * 100) / 100, count };
}
