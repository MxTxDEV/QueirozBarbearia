"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { dateOnly } from "@/lib/availability-helpers";
import { appointmentClientName } from "@/lib/appointment-client";
import { hhmmToMinutes } from "@/lib/quick-slots";
import { validateBreakWindow } from "@/lib/break-move";
import { shopNow } from "@/lib/shop-time";
import { formatDate, formatTime } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

const moveSchema = z.object({
  barberId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  /** DAY: só nessa data. WEEKDAY: padrão de todos os mesmos dias da semana daqui pra frente. */
  scope: z.enum(["DAY", "WEEKDAY"]),
});

export type MoveBarberBreakInput = z.infer<typeof moveSchema>;

class BreakMoveError extends Error {}

/**
 * Move o intervalo (almoço) de um barbeiro, vindo do arrastar no calendário.
 * Revalida tudo no servidor (o cliente nunca é confiável): permissão, expediente,
 * e que o novo horário não cai em cima de agendamento/HOLD — nunca mexe em
 * agendamento existente, só recusa e diz quais. A checagem e a gravação rodam
 * numa transação Serializable pra um agendamento criado ao mesmo tempo não
 * escapar da checagem.
 */
export async function moveBarberBreakAction(input: MoveBarberBreakInput): Promise<ActionResult<{ scope: "DAY" | "WEEKDAY" }>> {
  try {
    const user = await requireAdminContext();
    const data = moveSchema.parse(input);

    if (user.role === "BARBER" && user.barberId !== data.barberId) {
      return actionError(new Error("Você só pode mudar o seu próprio intervalo."));
    }

    const barber = await prisma.barber.findFirst({ where: { id: data.barberId, companyId: user.companyId } });
    if (!barber) return actionError(new Error("Barbeiro não encontrado."));

    const day = dateOnly(new Date(`${data.date}T00:00:00.000Z`));
    if (day.getTime() < dateOnly(shopNow()).getTime()) {
      return actionError(new Error("Não dá pra mudar o intervalo de um dia que já passou."));
    }

    const weekday = day.getUTCDay();
    const workingHour = await prisma.barberWorkingHour.findUnique({ where: { barberId_weekday: { barberId: barber.id, weekday } } });
    if (!workingHour) return actionError(new Error(`${barber.name} não trabalha neste dia da semana.`));

    const next = { start: hhmmToMinutes(data.start), end: hhmmToMinutes(data.end) };
    const invalid = validateBreakWindow(next, { start: hhmmToMinutes(workingHour.startTime), end: hhmmToMinutes(workingHour.endTime) });
    if (invalid) return actionError(new Error(invalid));

    await prisma.$transaction(
      async (tx) => {
        const timeOff = await tx.barberTimeOff.findFirst({
          where: { barberId: barber.id, startDate: { lte: day }, endDate: { gte: day } },
        });
        if (data.scope === "DAY" && timeOff) throw new BreakMoveError(`${barber.name} está de folga neste dia.`);

        // Dias que seriam afetados pela mudança.
        const affectedDays: Date[] = [];
        if (data.scope === "DAY") {
          affectedDays.push(day);
        } else {
          const overrides = await tx.barberBreakOverride.findMany({ where: { barberId: barber.id, date: { gte: day } }, select: { date: true } });
          const overridden = new Set(overrides.map((o) => o.date.toISOString().slice(0, 10)));
          const future = await tx.appointment.findMany({
            where: { barberId: barber.id, companyId: user.companyId, appointmentDate: { gte: day }, status: { in: [...ACTIVE_STATUSES] } },
            select: { appointmentDate: true },
            distinct: ["appointmentDate"],
          });
          for (const f of future) {
            const key = f.appointmentDate.toISOString().slice(0, 10);
            if (f.appointmentDate.getUTCDay() === weekday && !overridden.has(key)) affectedDays.push(f.appointmentDate);
          }
        }

        const conflicts: string[] = [];
        for (const affected of affectedDays) {
          const startOfDay = affected.getTime();
          const newStart = new Date(startOfDay + next.start * 60_000);
          const newEnd = new Date(startOfDay + next.end * 60_000);

          const appts = await tx.appointment.findMany({
            where: {
              barberId: barber.id,
              companyId: user.companyId,
              appointmentDate: affected,
              status: { in: [...ACTIVE_STATUSES] },
              startTime: { lt: newEnd },
              endTime: { gt: newStart },
            },
            include: { customer: true },
            take: 3,
          });
          for (const a of appts) {
            conflicts.push(`${formatDate(a.appointmentDate)} ${formatTime(a.startTime)}–${formatTime(a.endTime)} (${appointmentClientName(a)})`);
          }
          const holds = await tx.waitlistEntry.count({
            where: {
              offeredBarberId: barber.id,
              status: "OFFERED",
              holdExpiresAt: { gt: new Date() },
              offeredStartTime: { lt: newEnd },
              offeredEndTime: { gt: newStart },
            },
          });
          if (holds > 0) conflicts.push(`${formatDate(affected)}: reserva temporária da lista de espera em andamento`);
          if (conflicts.length >= 5) break;
        }
        if (conflicts.length > 0) {
          throw new BreakMoveError(
            `Não dá pra colocar o intervalo aí: já há agendamento nesse horário — ${conflicts.slice(0, 5).join("; ")}. Cancele ou remarque antes.`
          );
        }

        if (data.scope === "DAY") {
          const sameAsWeekly = workingHour.breakStart === data.start && workingHour.breakEnd === data.end;
          if (sameAsWeekly) {
            await tx.barberBreakOverride.deleteMany({ where: { barberId: barber.id, date: day } });
          } else {
            await tx.barberBreakOverride.upsert({
              where: { barberId_date: { barberId: barber.id, date: day } },
              create: { barberId: barber.id, date: day, breakStart: data.start, breakEnd: data.end },
              update: { breakStart: data.start, breakEnd: data.end },
            });
          }
        } else {
          await tx.barberWorkingHour.update({
            where: { barberId_weekday: { barberId: barber.id, weekday } },
            data: { breakStart: data.start, breakEnd: data.end },
          });
          // A exceção do dia clicado deixa de fazer sentido: o dia passa a seguir o novo padrão.
          await tx.barberBreakOverride.deleteMany({ where: { barberId: barber.id, date: day } });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "barber_break_moved",
      entityType: "barber",
      entityId: barber.id,
      metadata: { date: data.date, from: `${workingHour.breakStart ?? ""}–${workingHour.breakEnd ?? ""}`, to: `${data.start}–${data.end}`, scope: data.scope },
    });

    revalidatePath("/admin/appointments");
    revalidatePath(`/admin/barbers/${barber.id}`);
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess({ scope: data.scope });
  } catch (error) {
    if (error instanceof BreakMoveError) return actionError(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return actionError(new Error("Outra alteração aconteceu ao mesmo tempo. Tente de novo."));
    }
    return actionError(error);
  }
}
