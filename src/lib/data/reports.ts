import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { periodToDates, type PeriodFilter } from "@/lib/data/financial";

export async function getFinancialReport(companyId: string, period: PeriodFilter) {
  const { from, to } = periodToDates(period);
  const where = from && to ? { companyId, transactionDate: { gte: from, lt: to } } : { companyId };

  // Soma por categoria+tipo feita no banco (groupBy) em vez de trazer toda
  // linha do período pra somar em JS — período "all" numa empresa antiga
  // significava carregar a tabela inteira só pra agregar.
  const grouped = await prisma.financialTransaction.groupBy({
    by: ["category", "type"],
    where,
    _sum: { amount: true },
  });

  const byCategory = new Map<string, { income: number; expense: number }>();
  let income = 0;
  let expense = 0;

  for (const g of grouped) {
    const amount = toNumber(g._sum.amount);
    const entry = byCategory.get(g.category) ?? { income: 0, expense: 0 };
    if (g.type === "INCOME") {
      income += amount;
      entry.income += amount;
    } else {
      expense += amount;
      entry.expense += amount;
    }
    byCategory.set(g.category, entry);
  }

  return {
    income,
    expense,
    profit: income - expense,
    byCategory: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })),
  };
}

export async function getOperationalReport(companyId: string, period: PeriodFilter) {
  const { from, to } = periodToDates(period);
  const where = from && to ? { companyId, appointmentDate: { gte: from, lt: to } } : { companyId };

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

export async function getCustomerReport(companyId: string, period: PeriodFilter) {
  const { from, to } = periodToDates(period);

  const [newCustomers, topSpendersRaw] = await Promise.all([
    prisma.customer.count({ where: from && to ? { companyId, createdAt: { gte: from, lt: to } } : { companyId } }),
    prisma.payment.groupBy({
      by: ["customerId"],
      where: { companyId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);

  const customers = await prisma.customer.findMany({
    where: { companyId, id: { in: topSpendersRaw.map((t) => t.customerId) } },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const topSpenders = topSpendersRaw.map((t) => ({
    customer: customerMap.get(t.customerId),
    total: toNumber(t._sum.amount),
  }));

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
  const [recurrentCount, inactiveCount] = await Promise.all([
    prisma.customer.count({ where: { companyId, appointments: { some: { status: "COMPLETED" } } } }),
    prisma.customer.count({
      where: {
        companyId,
        appointments: { none: { appointmentDate: { gte: sixtyDaysAgo } } },
        createdAt: { lt: sixtyDaysAgo },
      },
    }),
  ]);

  return { newCustomers, topSpenders, recurrentCount, inactiveCount };
}
