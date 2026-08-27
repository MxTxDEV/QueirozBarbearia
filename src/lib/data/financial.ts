import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

export type PeriodFilter = "today" | "week" | "month" | "year" | "all";

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function periodToDates(period: PeriodFilter): { from?: Date; to?: Date } {
  const today = dateOnlyUTC(new Date());
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + 1);

  if (period === "today") return { from: today, to };
  if (period === "week") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 7);
    return { from, to };
  }
  if (period === "month") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from, to };
  }
  if (period === "year") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return { from, to };
  }
  return {};
}

/** Marca despesas pendentes vencidas como OVERDUE (Regra de negócio de despesas). */
export async function syncOverdueExpenses() {
  await prisma.expense.updateMany({
    where: { status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}

export async function getCashFlow(period: PeriodFilter) {
  const { from, to } = periodToDates(period);
  const where = from && to ? { transactionDate: { gte: from, lt: to } } : {};

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.financialTransaction.aggregate({ where: { ...where, type: "INCOME" }, _sum: { amount: true } }),
    prisma.financialTransaction.aggregate({ where: { ...where, type: "EXPENSE" }, _sum: { amount: true } }),
  ]);

  const income = toNumber(incomeAgg._sum.amount);
  const expense = toNumber(expenseAgg._sum.amount);

  return { income, expense, balance: income - expense };
}

export async function listTransactions(period: PeriodFilter = "month") {
  const { from, to } = periodToDates(period);
  const where = from && to ? { transactionDate: { gte: from, lt: to } } : {};

  return prisma.financialTransaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
    include: { customer: true },
  });
}

export async function listExpenses() {
  await syncOverdueExpenses();
  return prisma.expense.findMany({ orderBy: { dueDate: "desc" } });
}

export async function getMonthOverview() {
  const cashFlow = await getCashFlow("month");
  const { from, to } = periodToDates("month");
  const [appointmentsCount, cancelledCount] = await Promise.all([
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: "CANCELLED" } }),
  ]);
  return { ...cashFlow, appointmentsCount, cancelledCount };
}
