import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { periodToDates, type PeriodFilter } from "@/lib/data/financial";

export async function getFinancialReport(period: PeriodFilter) {
  const { from, to } = periodToDates(period);
  const where = from && to ? { transactionDate: { gte: from, lt: to } } : {};

  const transactions = await prisma.financialTransaction.findMany({ where });

  const byCategory = new Map<string, { income: number; expense: number }>();
  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    const amount = toNumber(t.amount);
    const entry = byCategory.get(t.category) ?? { income: 0, expense: 0 };
    if (t.type === "INCOME") {
      income += amount;
      entry.income += amount;
    } else {
      expense += amount;
      entry.expense += amount;
    }
    byCategory.set(t.category, entry);
  }

  return {
    income,
    expense,
    profit: income - expense,
    byCategory: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })),
  };
}

export async function getOperationalReport(period: PeriodFilter) {
  const { from, to } = periodToDates(period);
  const where = from && to ? { appointmentDate: { gte: from, lt: to } } : {};

  const [total, completed, cancelled, noShow, confirmed, pending] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.appointment.count({ where: { ...where, status: "NO_SHOW" } }),
    prisma.appointment.count({ where: { ...where, status: "CONFIRMED" } }),
    prisma.appointment.count({ where: { ...where, status: "PENDING" } }),
  ]);

  const confirmationRate = total > 0 ? ((confirmed + completed) / total) * 100 : 0;

  return { total, completed, cancelled, noShow, confirmed, pending, confirmationRate };
}

export async function getCustomerReport(period: PeriodFilter) {
  const { from, to } = periodToDates(period);

  const [newCustomers, topSpendersRaw] = await Promise.all([
    prisma.customer.count({ where: from && to ? { createdAt: { gte: from, lt: to } } : undefined }),
    prisma.payment.groupBy({
      by: ["customerId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);

  const customers = await prisma.customer.findMany({
    where: { id: { in: topSpendersRaw.map((t) => t.customerId) } },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const topSpenders = topSpendersRaw.map((t) => ({
    customer: customerMap.get(t.customerId),
    total: toNumber(t._sum.amount),
  }));

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
  const [recurrentCount, inactiveCount] = await Promise.all([
    prisma.customer.count({ where: { appointments: { some: { status: "COMPLETED" } } } }),
    prisma.customer.count({
      where: {
        appointments: { none: { appointmentDate: { gte: sixtyDaysAgo } } },
        createdAt: { lt: sixtyDaysAgo },
      },
    }),
  ]);

  return { newCustomers, topSpenders, recurrentCount, inactiveCount };
}
