import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { periodToDates } from "@/lib/data/financial";

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Comparativo de barbeiros no mês corrente (atendimentos, cancelamentos e
 * receita). Antes: 1 query pra listar barbeiros + 3 queries por barbeiro
 * (3N+1 no total). Agora: 1 query pra listar barbeiros + 1 groupBy de
 * status por barbeiro + 1 findMany de transações de receita — 3 queries
 * fixas, independente do número de barbeiros.
 */
export async function getBarberComparison(companyId: string) {
  const { from, to } = periodToDates("month");
  const barbers = await prisma.barber.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } });
  const barberIds = barbers.map((b) => b.id);

  const [statusCounts, incomeTxs] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["barberId", "status"],
      where: {
        companyId,
        barberId: { in: barberIds },
        appointmentDate: { gte: from, lt: to },
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      _count: { _all: true },
    }),
    // Receita fica em FinancialTransaction ligada ao agendamento (não dá pra
    // groupBy direto pela relação), então busca tudo de uma vez e soma em JS.
    prisma.financialTransaction.findMany({
      where: {
        companyId,
        type: "INCOME",
        transactionDate: { gte: from, lt: to },
        appointment: { barberId: { in: barberIds } },
      },
      select: { amount: true, appointment: { select: { barberId: true } } },
    }),
  ]);

  const completedByBarber = new Map<string, number>();
  const cancelledByBarber = new Map<string, number>();
  for (const row of statusCounts) {
    if (row.status === "COMPLETED") completedByBarber.set(row.barberId, row._count._all);
    if (row.status === "CANCELLED") cancelledByBarber.set(row.barberId, row._count._all);
  }

  const revenueByBarber = new Map<string, number>();
  for (const tx of incomeTxs) {
    const barberId = tx.appointment?.barberId;
    if (!barberId) continue;
    revenueByBarber.set(barberId, (revenueByBarber.get(barberId) ?? 0) + toNumber(tx.amount));
  }

  return barbers.map((barber) => {
    const completed = completedByBarber.get(barber.id) ?? 0;
    const cancelled = cancelledByBarber.get(barber.id) ?? 0;
    const revenue = revenueByBarber.get(barber.id) ?? 0;
    const avgTicket = completed > 0 ? revenue / completed : 0;
    return { id: barber.id, name: barber.name, completed, cancelled, revenue, avgTicket };
  });
}

export async function getDashboardAlerts(companyId: string, barberId?: string) {
  const today = dateOnlyUTC(new Date());

  const [pendingConfirmation, overdueExpenses, goalsAtRiskCount, unpaidCompleted] = await Promise.all([
    prisma.appointment.count({ where: { companyId, status: "PENDING", ...(barberId ? { barberId } : {}) } }),
    // Despesas são do negócio, não de um barbeiro — não faz sentido num login de barbeiro (que nem vê Financeiro).
    barberId ? Promise.resolve(0) : prisma.expense.count({ where: { companyId, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: today } } }),
    prisma.financialGoal.count({ where: { companyId, status: "AT_RISK", ...(barberId ? { barberId } : {}) } }),
    prisma.appointment.count({ where: { companyId, status: "COMPLETED", payments: { none: {} }, ...(barberId ? { barberId } : {}) } }),
  ]);

  return { pendingConfirmation, overdueExpenses, goalsAtRiskCount, unpaidCompleted };
}
