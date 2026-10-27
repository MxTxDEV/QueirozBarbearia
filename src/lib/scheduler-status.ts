import "server-only";
import { prisma } from "@/lib/prisma";

/** Registro global (sem empresa) da última execução do agendador de lembretes. */
const KEY = "scheduler_last_run";

/** Carimba "o agendador rodou agora" — chamado tanto pelo agendador interno quanto pela rota de cron externa. */
export async function markSchedulerRun(now: Date = new Date()) {
  const value = now.toISOString();
  const updated = await prisma.systemSetting.updateMany({ where: { companyId: null, key: KEY }, data: { value } });
  if (updated.count === 0) await prisma.systemSetting.create({ data: { companyId: null, key: KEY, value } });
}

export async function getSchedulerLastRun(): Promise<Date | null> {
  const row = await prisma.systemSetting.findFirst({ where: { companyId: null, key: KEY }, orderBy: { updatedAt: "desc" }, select: { value: true } });
  if (!row) return null;
  const date = new Date(row.value);
  return Number.isNaN(date.getTime()) ? null : date;
}
