import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { periodToDates } from "@/lib/data/financial";

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getTodaySummary(companyId: string) {
  const { from, to } = periodToDates("today");

  const [appointmentsToday, confirmedToday, pendingToday, cancelledToday, incomeAgg, expenseAgg] = await Promise.all([
    prisma.appointment.count({ where: { companyId, appointmentDate: { gte: from, lt: to } } }),
    prisma.appointment.count({ where: { companyId, appointmentDate: { gte: from, lt: to }, status: "CONFIRMED" } }),
    prisma.appointment.count({ where: { companyId, appointmentDate: { gte: from, lt: to }, status: "PENDING" } }),
    prisma.appointment.count({ where: { companyId, appointmentDate: { gte: from, lt: to }, status: "CANCELLED" } }),
    prisma.financialTransaction.aggregate({
      where: { companyId, type: "INCOME", transactionDate: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { companyId, type: "EXPENSE", transactionDate: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
  ]);

  const income = toNumber(incomeAgg._sum.amount);
  const expense = toNumber(expenseAgg._sum.amount);
  const completedToday = await prisma.appointment.count({
    where: { companyId, appointmentDate: { gte: from, lt: to }, status: "COMPLETED" },
  });
  const ticketMedio = completedToday > 0 ? income / completedToday : 0;

  return {
    appointmentsToday,
    confirmedToday,
    pendingToday,
    cancelledToday,
    completedToday,
    income,
    expense,
    balance: income - expense,
    ticketMedio,
  };
}

export async function getMonthSummary(companyId: string) {
  const { from, to } = periodToDates("month");
  const [incomeAgg, expenseAgg, activeGoal] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where: { companyId, type: "INCOME", transactionDate: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { companyId, type: "EXPENSE", transactionDate: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.financialGoal.findFirst({
      where: { companyId, type: "REVENUE", startDate: { lte: to }, endDate: { gte: from } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const income = toNumber(incomeAgg._sum.amount);
  const expense = toNumber(expenseAgg._sum.amount);
  const targetValue = activeGoal ? toNumber(activeGoal.targetValue) : null;
  const goalPercent = targetValue && targetValue > 0 ? Math.min(100, (income / targetValue) * 100) : null;

  return { income, expense, profit: income - expense, targetValue, goalPercent };
}

export async function getBarberComparison(companyId: string) {
  const { from, to } = periodToDates("month");
  const barbers = await prisma.barber.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } });

  return Promise.all(
    barbers.map(async (barber) => {
      const [completed, cancelled, incomeAgg] = await Promise.all([
        prisma.appointment.count({
          where: { companyId, barberId: barber.id, appointmentDate: { gte: from, lt: to }, status: "COMPLETED" },
        }),
        prisma.appointment.count({
          where: { companyId, barberId: barber.id, appointmentDate: { gte: from, lt: to }, status: "CANCELLED" },
        }),
        prisma.financialTransaction.aggregate({
          where: { companyId, type: "INCOME", transactionDate: { gte: from, lt: to }, appointment: { barberId: barber.id } },
          _sum: { amount: true },
        }),
      ]);

      const revenue = toNumber(incomeAgg._sum.amount);
      const avgTicket = completed > 0 ? revenue / completed : 0;

      return { id: barber.id, name: barber.name, completed, cancelled, revenue, avgTicket };
    })
  );
}

export async function getUpcomingAppointments(companyId: string, limit = 8) {
  return prisma.appointment.findMany({
    where: { companyId, status: { in: ["PENDING", "CONFIRMED"] }, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    take: limit,
    include: { customer: true, barber: true, services: true },
  });
}

export async function getDashboardAlerts(companyId: string) {
  const today = dateOnlyUTC(new Date());

  const [pendingConfirmation, overdueExpenses, goalsAtRiskCount, unpaidCompleted] = await Promise.all([
    prisma.appointment.count({ where: { companyId, status: "PENDING" } }),
    prisma.expense.count({ where: { companyId, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: today } } }),
    prisma.financialGoal.count({ where: { companyId, status: "AT_RISK" } }),
    prisma.appointment.count({ where: { companyId, status: "COMPLETED", payments: { none: {} } } }),
  ]);

  return { pendingConfirmation, overdueExpenses, goalsAtRiskCount, unpaidCompleted };
}
