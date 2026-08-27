import type { RecurrenceType } from "@prisma/client";

/** Calcula a próxima data de vencimento com base no tipo de recorrência. */
export function nextRecurrenceDate(date: Date, type: RecurrenceType): Date | null {
  const next = new Date(date);
  if (type === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  if (type === "MONTHLY") {
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
  if (type === "YEARLY") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    return next;
  }
  return null;
}
