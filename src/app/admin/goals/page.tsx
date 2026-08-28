import { prisma } from "@/lib/prisma";
import { getGoalsWithProgress } from "@/lib/data/goals";
import { deleteGoalAction } from "@/actions/goals";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GOAL_STATUS_LABEL, GOAL_STATUS_VARIANT, GOAL_TYPE_LABEL } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GoalForm } from "./goal-form";
import { requireAdminContext } from "@/lib/require-admin";

export default async function GoalsPage() {
  const user = await requireAdminContext();
  const isAdmin = user.role === "ADMIN";
  const barberId = isAdmin ? undefined : (user.barberId ?? undefined);
  const [goals, barbers] = await Promise.all([
    getGoalsWithProgress(user.companyId, barberId),
    isAdmin ? prisma.barber.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Metas</h1>
        <p className="text-sm text-foreground-muted">Metas de faturamento, atendimentos e por barbeiro.</p>
      </div>

      <div className={isAdmin ? "grid gap-6 lg:grid-cols-3" : "grid gap-6"}>
        <div className={isAdmin ? "min-w-0 space-y-4 lg:col-span-2" : "min-w-0 space-y-4"}>
          {goals.length === 0 && (
            <Card>
              <CardContent className="text-center text-sm text-foreground-muted">Nenhuma meta cadastrada.</CardContent>
            </Card>
          )}
          {goals.map((g) => {
            const isAppointments = g.goal.type === "APPOINTMENTS";
            return (
              <Card key={g.goal.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-foreground">{g.goal.title}</CardTitle>
                    <Badge variant={GOAL_STATUS_VARIANT[g.status]}>{GOAL_STATUS_LABEL[g.status]}</Badge>
                  </div>
                  <p className="text-xs text-foreground-muted">
                    {GOAL_TYPE_LABEL[g.goal.type]}
                    {g.goal.barber ? ` · ${g.goal.barber.name}` : ""} · {formatDate(g.goal.startDate)} até{" "}
                    {formatDate(g.goal.endDate)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={g.percent} />
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-foreground-muted">Atual</p>
                      <p className="font-medium text-foreground">
                        {isAppointments ? g.currentValue : formatCurrency(g.currentValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Meta</p>
                      <p className="font-medium text-foreground">
                        {isAppointments ? g.goal.targetValue.toString() : formatCurrency(g.goal.targetValue.toString())}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Restante</p>
                      <p className="font-medium text-foreground">
                        {isAppointments ? Math.round(g.remaining) : formatCurrency(g.remaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Dias restantes</p>
                      <p className="font-medium text-foreground">{g.daysRemaining}</p>
                    </div>
                  </div>
                  <p className="text-xs text-foreground-muted">
                    Projeção pelo ritmo atual: {isAppointments ? Math.round(g.projection) : formatCurrency(g.projection)}
                  </p>
                  {isAdmin && (
                    <form action={deleteGoalAction.bind(null, g.goal.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Remover meta
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Nova meta</CardTitle>
            </CardHeader>
            <CardContent>
              <GoalForm barbers={barbers} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
