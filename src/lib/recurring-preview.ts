import "server-only";
import { prisma } from "@/lib/prisma";
import { dateOnly, hasSchedulingConflict, timeOnDate } from "@/lib/availability";
import { explainSchedulingConflict } from "@/lib/conflict-explain";
import { shopNow } from "@/lib/shop-time";

export type DatePreview = { date: string; available: boolean; message?: string };

const CONCURRENCY = 6;

/**
 * Prévia (só leitura) de cada data de uma recorrência: o horário está livre para esse barbeiro?
 * Usa a MESMA regra de quando a equipe cria (qualquer dia, inclusive fora do expediente/folga/feriado — só não
 * passa por cima de outro cliente nem de bloqueio), então o que a tela mostra como livre é o que será marcado.
 */
export async function previewRecurringDates(params: {
  companyId: string;
  barberId: string;
  serviceId: string;
  startTime: string;
  dates: string[];
}): Promise<DatePreview[]> {
  const [barber, service] = await Promise.all([
    prisma.barber.findFirst({ where: { id: params.barberId, companyId: params.companyId }, select: { id: true } }),
    prisma.service.findFirst({ where: { id: params.serviceId, companyId: params.companyId }, select: { durationMinutes: true } }),
  ]);
  if (!barber) throw new Error("Barbeiro indisponível.");
  if (!service) throw new Error("Serviço indisponível.");

  const now = shopNow();
  const one = async (dateStr: string): Promise<DatePreview> => {
    const day = dateOnly(new Date(`${dateStr}T00:00:00.000Z`));
    const startTime = timeOnDate(day, params.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60_000);
    if (startTime.getTime() < now.getTime() - 60_000) return { date: dateStr, available: false, message: "Esse horário já passou." };
    const conflict = await hasSchedulingConflict({ barberId: params.barberId, startTime, endTime, allowOutsideHours: true });
    if (!conflict) return { date: dateStr, available: true };
    return { date: dateStr, available: false, message: await explainSchedulingConflict(prisma, { barberId: params.barberId, day, startTime, endTime }) };
  };

  const results: DatePreview[] = new Array(params.dates.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, params.dates.length) }, async () => {
      while (next < params.dates.length) {
        const i = next++;
        results[i] = await one(params.dates[i]);
      }
    })
  );
  return results;
}
