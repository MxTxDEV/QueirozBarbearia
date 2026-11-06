import { formatCurrency } from "@/lib/utils";

/** Agendamentos cancelados ou com falta não entram no faturamento do dia. */
const NOT_REVENUE = new Set(["CANCELLED", "NO_SHOW"]);

export type DayRevenue = {
  /** Soma dos agendamentos do dia (pendentes, confirmados e concluídos). */
  total: number;
  /** Parte já concluída (atendimento feito). */
  done: number;
  count: number;
};

export function sumDayRevenue(items: { status: string; value: number }[]): DayRevenue {
  let total = 0;
  let done = 0;
  let count = 0;
  for (const item of items) {
    if (NOT_REVENUE.has(item.status)) continue;
    total += item.value;
    count++;
    if (item.status === "COMPLETED") done += item.value;
  }
  return { total: Math.round(total * 100) / 100, done: Math.round(done * 100) / 100, count };
}

export function revenueLabel(revenue: DayRevenue) {
  return formatCurrency(revenue.total);
}
