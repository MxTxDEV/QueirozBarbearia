"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { appointmentClientName } from "@/lib/appointment-client";
import { logAudit } from "@/lib/audit";
import { formatTime } from "@/lib/utils";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const resizeSchema = z.object({
  appointmentId: z.string().min(1),
  /** Nova duração total do atendimento, em minutos (de 15 em 15). */
  durationMin: z.coerce.number().int().min(15, "O atendimento precisa ter ao menos 15 minutos.").max(12 * 60, "Duração máxima: 12 horas."),
});

export type ResizeAppointmentInput = z.input<typeof resizeSchema>;

class ResizeError extends Error {}

/**
 * Aumenta (ou diminui) o tempo de um atendimento arrastando a bolinha da agenda — o início fica, só o fim
 * muda. Quem manda aqui é o barbeiro/recepção: pode passar do almoço ou do fim do expediente (ex: o salão
 * fecha às 17h e o corte vai até 17h30). A única trava é não atropelar OUTRO cliente (nem uma vaga
 * reservada da lista de espera). Serviços e valor não mudam. Checagem e gravação em transação Serializable.
 */
export async function resizeAppointmentAction(input: ResizeAppointmentInput): Promise<ActionResult<{ endLabel: string }>> {
  try {
    const user = await requireAdminContext();
    const data = resizeSchema.parse(input);

    const appt = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, companyId: user.companyId },
      include: { customer: true },
    });
    if (!appt) return actionError(new Error("Agendamento não encontrado."));
    if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
      return actionError(new Error("Só dá pra mudar a duração de agendamentos pendentes ou confirmados."));
    }
    if (user.role === "BARBER" && appt.barberId !== user.barberId) {
      return actionError(new Error("Você só pode mudar horários dos seus próprios agendamentos."));
    }

    const startTime = appt.startTime;
    const endTime = new Date(startTime.getTime() + data.durationMin * 60_000);
    // O atendimento tem que terminar no mesmo dia (relógio de parede guardado em UTC).
    const midnight = Date.UTC(startTime.getUTCFullYear(), startTime.getUTCMonth(), startTime.getUTCDate() + 1);
    if (endTime.getTime() > midnight) return actionError(new Error("O atendimento não pode passar da meia-noite."));
    if (endTime.getTime() === appt.endTime.getTime()) return actionError(new Error("A duração já é essa."));

    await prisma.$transaction(
      async (tx) => {
        const other = await tx.appointment.findFirst({
          where: {
            barberId: appt.barberId,
            appointmentDate: appt.appointmentDate,
            status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
            id: { not: appt.id },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          include: { customer: true },
        });
        if (other) {
          throw new ResizeError(`Não dá: até ${formatTime(endTime)} bate no horário de ${appointmentClientName(other)} (${formatTime(other.startTime)}–${formatTime(other.endTime)}).`);
        }
        const hold = await tx.waitlistEntry.findFirst({
          where: {
            offeredBarberId: appt.barberId,
            status: "OFFERED",
            holdExpiresAt: { gt: new Date() },
            offeredStartTime: { lt: endTime },
            offeredEndTime: { gt: startTime },
          },
        });
        if (hold) throw new ResizeError("Esse período está reservado para alguém da lista de espera.");

        await tx.appointment.update({ where: { id: appt.id }, data: { endTime, totalDurationMin: data.durationMin } });
        await tx.recurringAppointmentOccurrence.updateMany({
          where: { appointmentId: appt.id, recurringAppointment: { companyId: user.companyId } },
          data: { scheduledEndTime: endTime },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "appointment_resized",
      entityType: "appointment",
      entityId: appt.id,
      appointmentId: appt.id,
      metadata: { fromDurationMin: appt.totalDurationMin, toDurationMin: data.durationMin, endTime: endTime.toISOString() },
    });

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/recurring-appointments");
    return actionSuccess({ endLabel: formatTime(endTime) });
  } catch (error) {
    if (error instanceof ResizeError) return actionError(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return actionError(new Error("Outra alteração aconteceu ao mesmo tempo. Tente de novo."));
    }
    return actionError(error);
  }
}
