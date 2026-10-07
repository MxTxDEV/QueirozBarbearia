"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { hasSchedulingConflict } from "@/lib/availability";
import { shopNow } from "@/lib/shop-time";
import { appointmentClientName } from "@/lib/appointment-client";
import { logAudit } from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/utils";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const moveSchema = z.object({
  appointmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  /** Ausente = mantém o horário do dia (arrastar pra outro dia no mês). */
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horário inválido.")
    .optional(),
  /** Ausente = mantém o barbeiro. */
  barberId: z.string().min(1).optional(),
});

export type MoveAppointmentInput = z.infer<typeof moveSchema>;

class MoveError extends Error {}

/**
 * Muda o dia/horário (e, opcionalmente, o barbeiro) de UM agendamento — vindo do
 * arrastar na agenda. Cancelar e recriar perderia histórico, pagamento e vínculo
 * com a recorrência; aqui o mesmo agendamento só muda de lugar, mantendo serviços,
 * valor e duração. Tudo é revalidado no servidor (o cliente nunca é confiável): o
 * agendamento ainda está pendente/confirmado, o barbeiro faz os serviços e a
 * duração CABE no novo lugar (expediente, intervalo, folga, bloqueios, outros
 * agendamentos). Checagem e gravação numa transação Serializable.
 */
export async function moveAppointmentAction(input: MoveAppointmentInput): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = moveSchema.parse(input);

    const appt = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, companyId: user.companyId },
      include: { customer: true, barber: true, services: true },
    });
    if (!appt) return actionError(new Error("Agendamento não encontrado."));
    if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
      return actionError(new Error("Só dá pra mudar o horário de agendamentos pendentes ou confirmados."));
    }

    const targetBarberId = data.barberId ?? appt.barberId;
    if (user.role === "BARBER" && (appt.barberId !== user.barberId || targetBarberId !== user.barberId)) {
      return actionError(new Error("Você só pode mudar horários dos seus próprios agendamentos."));
    }
    const barber = targetBarberId === appt.barberId ? appt.barber : await prisma.barber.findFirst({ where: { id: targetBarberId, companyId: user.companyId } });
    if (!barber || !barber.active) return actionError(new Error("Barbeiro indisponível."));

    // Horários são guardados como relógio de parede em UTC (ver availability.ts).
    const [year, month, day] = data.date.split("-").map(Number);
    const [hour, minute] = data.time
      ? data.time.split(":").map(Number)
      : [appt.startTime.getUTCHours(), appt.startTime.getUTCMinutes()];
    const startTime = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const endTime = new Date(startTime.getTime() + (appt.endTime.getTime() - appt.startTime.getTime()));
    const appointmentDate = new Date(Date.UTC(year, month - 1, day));

    if (startTime.getTime() === appt.startTime.getTime() && targetBarberId === appt.barberId) {
      return actionError(new Error("O agendamento já está nesse horário."));
    }
    if (startTime.getTime() < shopNow().getTime() - 60_000) {
      return actionError(new Error("Não dá pra mover para um horário que já passou."));
    }

    if (targetBarberId !== appt.barberId) {
      const serviceIds = appt.services.map((s) => s.serviceId);
      const offered = await prisma.barberService.count({ where: { barberId: targetBarberId, serviceId: { in: serviceIds } } });
      if (offered !== serviceIds.length) {
        return actionError(new Error(`${barber.name} não faz todos os serviços de ${appointmentClientName(appt)} (${appt.services.map((s) => s.serviceName).join(", ")}).`));
      }
    }

    await prisma.$transaction(
      async (tx) => {
        const conflict = await hasSchedulingConflict(
          { barberId: targetBarberId, startTime, endTime, excludeAppointmentId: appt.id },
          tx
        );
        if (conflict) {
          throw new MoveError(
            `${appointmentClientName(appt)} não cabe em ${formatDate(appointmentDate)} ${formatTime(startTime)}–${formatTime(endTime)} com ${barber.name}: fora do expediente, no intervalo/folga, ou já há outro agendamento nesse período.`
          );
        }

        await tx.appointment.update({
          where: { id: appt.id },
          data: {
            barberId: targetBarberId,
            appointmentDate,
            startTime,
            endTime,
            // Horário novo: os lembretes automáticos precisam valer pro novo horário.
            reminder24hSentAt: null,
            reminder1hSentAt: null,
          },
        });
        // Agendamento de recorrência: a ocorrência acompanha o dia/horário novo.
        await tx.recurringAppointmentOccurrence.updateMany({
          where: { appointmentId: appt.id, recurringAppointment: { companyId: user.companyId } },
          data: { scheduledDate: appointmentDate, scheduledStartTime: startTime, scheduledEndTime: endTime },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "appointment_moved",
      entityType: "appointment",
      entityId: appt.id,
      appointmentId: appt.id,
      metadata: {
        from: { barberId: appt.barberId, startTime: appt.startTime.toISOString() },
        to: { barberId: targetBarberId, startTime: startTime.toISOString() },
      },
    });

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/recurring-appointments");
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess();
  } catch (error) {
    if (error instanceof MoveError) return actionError(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return actionError(new Error("Outra alteração aconteceu ao mesmo tempo. Tente de novo."));
    }
    return actionError(error);
  }
}
