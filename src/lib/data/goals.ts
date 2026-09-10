import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { endOfGoalDay } from "@/lib/goal-date-range";
import type { FinancialGoal } from "@prisma/client";

export type GoalProgress = {
  goal: FinancialGoal & { barber: { id: string; name: string } | null };
  currentValue: number;
  percent: number;
  remaining: number;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  projection: number;
  status: "ACTIVE" | "ACHIEVED" | "AT_RISK" | "EXPIRED";
};

async function computeCurrentValue(goal: FinancialGoal): Promise<number> {
  const exclusiveEnd = endOfGoalDay(goal.endDate);

  if (goal.type === "APPOINTMENTS") {
    const count = await prisma.appointment.count({
      where: {
        companyId: goal.companyId,
        appointmentDate: { gte: goal.startDate, lt: exclusiveEnd },
        status: { in: ["CONFIRMED", "COMPLETED"] },
        ...(goal.barberId ? { barberId: goal.barberId } : {}),
      },
    });
    return count;
  }

  // barberId direto na transação (populado tanto por vendas do PDV quanto
  // por pagamentos de agendamento — ver comentário no schema) substitui o
  // join indireto por appointment.barberId: uma meta BARBER_REVENUE agora
  // soma as duas origens de faturamento com a mesma condição.
  const agg = await prisma.financialTransaction.aggregate({
    where: {
      companyId: goal.companyId,
      type: "INCOME",
      transactionDate: { gte: goal.startDate, lt: exclusiveEnd },
      ...(goal.barberId ? { barberId: goal.barberId } : {}),
    },
    _sum: { amount: true },
  });
  return toNumber(agg._sum.amount);
}

/**
 * `barberId` restringe às metas individuais daquele barbeiro (não mostra
 * metas de outro barbeiro nem metas gerais da empresa) — usado no login
 * de barbeiro, que só vê as próprias métricas.
 */
export async function getGoalsWithProgress(companyId: string, barberId?: string): Promise<GoalProgress[]> {
  const goals = await prisma.financialGoal.findMany({
    where: { companyId, ...(barberId ? { barberId } : {}) },
    orderBy: { endDate: "desc" },
    include: { barber: { select: { id: true, name: true } } },
  });

  const now = new Date();

  return Promise.all(
    goals.map(async (goal) => {
      const currentValue = await computeCurrentValue(goal);
      const target = toNumber(goal.targetValue);
      const percent = target > 0 ? Math.min(100, (currentValue / target) * 100) : 0;
      const remaining = Math.max(0, target - currentValue);

      const daysTotal = Math.max(
        1,
        Math.ceil((goal.endDate.getTime() - goal.startDate.getTime()) / 86_400_000) + 1
      );
      const daysElapsed = Math.min(
        daysTotal,
        Math.max(0, Math.ceil((now.getTime() - goal.startDate.getTime()) / 86_400_000))
      );
      const daysRemaining = Math.max(0, Math.ceil((goal.endDate.getTime() - now.getTime()) / 86_400_000));

      const dailyAverage = daysElapsed > 0 ? currentValue / daysElapsed : 0;
      const projection = dailyAverage * daysTotal;

      let status: GoalProgress["status"] = "ACTIVE";
      if (currentValue >= target) status = "ACHIEVED";
      else if (now >= endOfGoalDay(goal.endDate)) status = "EXPIRED";
      else if (projection < target * 0.85) status = "AT_RISK";

      return {
        goal,
        currentValue,
        percent,
        remaining,
        daysTotal,
        daysElapsed,
        daysRemaining,
        projection,
        status,
      };
    })
  );
}
