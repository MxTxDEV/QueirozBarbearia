import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
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
  if (goal.type === "APPOINTMENTS") {
    const count = await prisma.appointment.count({
      where: {
        appointmentDate: { gte: goal.startDate, lte: goal.endDate },
        status: { in: ["CONFIRMED", "COMPLETED"] },
        ...(goal.barberId ? { barberId: goal.barberId } : {}),
      },
    });
    return count;
  }

  const agg = await prisma.financialTransaction.aggregate({
    where: {
      type: "INCOME",
      transactionDate: { gte: goal.startDate, lte: goal.endDate },
      ...(goal.barberId
        ? { appointment: { barberId: goal.barberId } }
        : {}),
    },
    _sum: { amount: true },
  });
  return toNumber(agg._sum.amount);
}

export async function getGoalsWithProgress(): Promise<GoalProgress[]> {
  const goals = await prisma.financialGoal.findMany({
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
      else if (now > goal.endDate) status = "EXPIRED";
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
