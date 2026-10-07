/** Agrupamento de série temporal do faturamento por barbeiro — puro (sem banco), testável. Datas são relógio de parede em UTC. */

export type BucketUnit = "day" | "month";

/** "2026-10-09" (dia) ou "2026-10" (mês). */
export function bucketKey(date: Date, unit: BucketUnit): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (unit === "month") return `${y}-${m}`;
  return `${y}-${m}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "09/10" (dia) ou "out/26" (mês). */
export function bucketLabel(key: string, unit: BucketUnit): string {
  const parts = key.split("-");
  if (unit === "month") return `${MONTHS_SHORT[Number(parts[1]) - 1]}/${parts[0].slice(2)}`;
  return `${parts[2]}/${parts[1]}`;
}

/** Percentual com 1 casa, ex: "43,5%". */
export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export type PeriodName = "today" | "week" | "month" | "year" | "all";

const DAY_MS = 86_400_000;

/**
 * Período imediatamente anterior, de mesmo tamanho, pra comparar ("vs período anterior").
 * `from`/`to` = intervalo atual [from, to). Mês e ano comparam "até hoje" com o mesmo trecho do
 * mês/ano anterior (sem invadir o período atual). "Tudo" não tem anterior.
 */
export function previousPeriodRange(period: PeriodName, from: Date, to: Date): { from: Date; to: Date } | null {
  if (period === "all") return null;
  const length = to.getTime() - from.getTime();
  if (period === "today" || period === "week") return { from: new Date(from.getTime() - length), to: new Date(from.getTime()) };
  if (period === "month") {
    const prevFrom = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
    return { from: prevFrom, to: new Date(Math.min(prevFrom.getTime() + length, from.getTime())) };
  }
  const prevFrom = new Date(Date.UTC(from.getUTCFullYear() - 1, 0, 1));
  return { from: prevFrom, to: new Date(Math.min(prevFrom.getTime() + length, from.getTime())) };
}

/** Variação percentual; null quando não há base de comparação (anterior = 0). */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export { DAY_MS };
