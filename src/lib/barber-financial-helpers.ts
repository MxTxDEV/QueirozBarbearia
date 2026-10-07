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
