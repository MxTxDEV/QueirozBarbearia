import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

/**
 * Job (cron) — percorre despesas vencidas de todas as empresas e notifica
 * cada uma isoladamente. Fica fora de src/actions (arquivos "use server",
 * cujas exportações viram endpoints RSC chamáveis do cliente) porque este
 * job varre todas as empresas de propósito — só deve ser acionado pela rota
 * protegida por segredo em src/app/api/system/cron/overdue-expenses.
 */
export async function checkOverdueExpensesAndNotify() {
  const overdue = await prisma.expense.findMany({ where: { status: "OVERDUE" } });
  let notified = 0;
  for (const expense of overdue) {
    const existing = await prisma.notification.findFirst({
      where: { companyId: expense.companyId, relatedEntityType: "expense", relatedEntityId: expense.id, type: "EXPENSE_OVERDUE" },
    });
    if (!existing) {
      await createNotification({
        companyId: expense.companyId,
        title: "⚠️ Despesa vencida",
        message: `${expense.description} venceu e ainda não foi paga.`,
        type: "EXPENSE_OVERDUE",
        relatedEntityType: "expense",
        relatedEntityId: expense.id,
      });
      notified++;
    }
  }
  return { checked: overdue.length, notified };
}
