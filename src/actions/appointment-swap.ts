"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { hasSchedulingConflict, overlaps } from "@/lib/availability";
import { shopNow } from "@/lib/shop-time";
import { appointmentClientName } from "@/lib/appointment-client";
import { logAudit } from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/utils";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const SWAPPABLE_STATUSES = ["PENDING", "CONFIRMED"];

class SwapError extends Error {}

type SwapSide = Prisma.AppointmentGetPayload<{
  include: { customer: true; barber: true; services: true };
}>;

/** Janela que o agendamento passa a ocupar: começa onde o outro começava (e no barbeiro dele), mantendo a própria duração. */
function newWindow(mover: SwapSide, target: SwapSide) {
  const durationMs = mover.endTime.getTime() - mover.startTime.getTime();
  const start = target.startTime;
  const end = new Date(start.getTime() + durationMs);
  const appointmentDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  return { barberId: target.barberId, start, end, appointmentDate };
}

/**
 * Troca de lugar dois agendamentos (arrastar um cliente em cima do outro no
 * calendário): cada um assume o horário (dia, hora e barbeiro) do outro,
 * mantendo os próprios serviços, valor e duração — sem cancelar nada.
 *
 * Tudo é revalidado no servidor: os dois ainda estão pendentes/confirmados, o
 * barbeiro de destino faz os serviços, e a duração de cada um CABE no novo
 * lugar (expediente, intervalo, folga, bloqueios e outros agendamentos). Se
 * não couber, nada muda e a mensagem diz quem não coube. A checagem e a
 * gravação rodam numa transação Serializable pra um agendamento criado ao
 * mesmo tempo não escapar da checagem.
 */
export async function swapAppointmentsAction(
  firstId: string,
  secondId: string
): Promise<ActionResult<{ firstName: string; secondName: string }>> {
  try {
    const user = await requireAdminContext();
    if (firstId === secondId) return actionError(new Error("Escolha dois agendamentos diferentes."));

    const loaded = await prisma.appointment.findMany({
      where: { id: { in: [firstId, secondId] }, companyId: user.companyId },
      include: { customer: true, barber: true, services: true },
    });
    const first = loaded.find((a) => a.id === firstId);
    const second = loaded.find((a) => a.id === secondId);
    if (!first || !second) return actionError(new Error("Agendamento não encontrado."));

    if (user.role === "BARBER" && (first.barberId !== user.barberId || second.barberId !== user.barberId)) {
      return actionError(new Error("Você só pode trocar horários dos seus próprios agendamentos."));
    }

    for (const appt of [first, second]) {
      if (!SWAPPABLE_STATUSES.includes(appt.status)) {
        return actionError(new Error(`O agendamento de ${appointmentClientName(appt)} não está mais pendente/confirmado — não dá pra trocar.`));
      }
    }

    const firstTo = newWindow(first, second);
    const secondTo = newWindow(second, first);

    const now = shopNow().getTime() - 60_000;
    for (const [appt, to] of [
      [first, firstTo],
      [second, secondTo],
    ] as const) {
      if (to.start.getTime() < now && to.start.getTime() !== appt.startTime.getTime()) {
        return actionError(new Error("Não dá pra trocar para um horário que já passou."));
      }
    }

    // Trocar de barbeiro só vale se o novo barbeiro faz os serviços do cliente.
    for (const [appt, to] of [
      [first, firstTo],
      [second, secondTo],
    ] as const) {
      if (to.barberId === appt.barberId) continue;
      const serviceIds = appt.services.map((s) => s.serviceId);
      const offered = await prisma.barberService.count({ where: { barberId: to.barberId, serviceId: { in: serviceIds } } });
      if (offered !== serviceIds.length) {
        const newBarber = to.barberId === first.barberId ? first.barber : second.barber;
        return actionError(
          new Error(`${newBarber.name} não faz todos os serviços de ${appointmentClientName(appt)} (${appt.services.map((s) => s.serviceName).join(", ")}).`)
        );
      }
    }

    // Se continuam no mesmo barbeiro, os dois novos lugares não podem se sobrepor entre si
    // (o hasSchedulingConflict ignora os dois agendamentos, então não enxerga um ao outro).
    if (
      firstTo.barberId === secondTo.barberId &&
      firstTo.appointmentDate.getTime() === secondTo.appointmentDate.getTime() &&
      overlaps(firstTo.start, firstTo.end, secondTo.start, secondTo.end)
    ) {
      throw new SwapError(
        `Não cabe: ${appointmentClientName(first)} (${formatTime(first.startTime)}–${formatTime(first.endTime)}) e ${appointmentClientName(second)} (${formatTime(second.startTime)}–${formatTime(second.endTime)}) têm durações diferentes e, trocados, um passaria por cima do outro.`
      );
    }

    await prisma.$transaction(
      async (tx) => {
        for (const [appt, to] of [
          [first, firstTo],
          [second, secondTo],
        ] as const) {
          const conflict = await hasSchedulingConflict(
            { barberId: to.barberId, startTime: to.start, endTime: to.end, excludeAppointmentId: [first.id, second.id] },
            tx
          );
          if (conflict) {
            throw new SwapError(
              `${appointmentClientName(appt)} não cabe no horário de ${formatTime(to.start)}–${formatTime(to.end)} (${formatDate(to.appointmentDate)}): há outro agendamento, bloqueio ou fica fora do expediente/intervalo.`
            );
          }
        }

        for (const [appt, to] of [
          [first, firstTo],
          [second, secondTo],
        ] as const) {
          await tx.appointment.update({
            where: { id: appt.id },
            data: {
              barberId: to.barberId,
              appointmentDate: to.appointmentDate,
              startTime: to.start,
              endTime: to.end,
              // Horário novo: os lembretes automáticos precisam valer pro novo horário.
              reminder24hSentAt: null,
              reminder1hSentAt: null,
            },
          });
          // Agendamento de recorrência: a ocorrência acompanha o dia/horário novo.
          await tx.recurringAppointmentOccurrence.updateMany({
            where: { appointmentId: appt.id, recurringAppointment: { companyId: user.companyId } },
            data: { scheduledDate: to.appointmentDate, scheduledStartTime: to.start, scheduledEndTime: to.end },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const firstName = appointmentClientName(first);
    const secondName = appointmentClientName(second);

    for (const [appt, from, to] of [
      [first, first, firstTo],
      [second, second, secondTo],
    ] as const) {
      await logAudit({
        companyId: user.companyId,
        userId: user.id,
        action: "appointment_swapped",
        entityType: "appointment",
        entityId: appt.id,
        appointmentId: appt.id,
        metadata: {
          withAppointmentId: appt.id === first.id ? second.id : first.id,
          from: { barberId: from.barberId, startTime: from.startTime.toISOString() },
          to: { barberId: to.barberId, startTime: to.start.toISOString() },
        },
      });
    }

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/recurring-appointments");
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess({ firstName, secondName });
  } catch (error) {
    if (error instanceof SwapError) return actionError(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return actionError(new Error("Outra alteração aconteceu ao mesmo tempo. Tente de novo."));
    }
    return actionError(error);
  }
}
