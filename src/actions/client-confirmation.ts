"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { shopNow } from "@/lib/shop-time";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { appointmentClientName } from "@/lib/appointment-client";
import { formatDate, formatTime } from "@/lib/utils";
import { cancelAppointmentCore } from "@/actions/appointments";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

/**
 * Confirmação do horário pelo próprio cliente, a partir do link enviado por WhatsApp
 * (/confirmar/[token]). Sem login: o token (aleatório, único por agendamento) é a credencial.
 */

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Link inválido.");

async function loadByToken(token: string) {
  const appt = await prisma.appointment.findUnique({
    where: { confirmToken: tokenSchema.parse(token) },
    include: { customer: true, barber: true, company: { select: { status: true } } },
  });
  if (!appt || appt.company.status !== "ACTIVE") throw new Error("Link inválido ou expirado.");
  if (appt.status === "CANCELLED") throw new Error("Este horário foi cancelado.");
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") throw new Error("Este horário não está mais disponível para confirmação.");
  if (appt.startTime.getTime() < shopNow().getTime()) throw new Error("Este horário já passou.");
  return appt;
}

/** "Confirmo meu horário": o agendamento fica confirmado e a barbearia é avisada. */
export async function confirmAppointmentByTokenAction(token: string): Promise<ActionResult<{ alreadyConfirmed: boolean }>> {
  try {
    const appt = await loadByToken(token);
    const alreadyConfirmed = appt.clientConfirmedAt !== null;

    if (!alreadyConfirmed) {
      const now = new Date();
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          clientConfirmedAt: now,
          ...(appt.status === "PENDING" ? { status: "CONFIRMED", confirmedAt: now } : {}),
        },
      });
      await logAudit({
        companyId: appt.companyId,
        action: "appointment_client_confirmed",
        entityType: "appointment",
        entityId: appt.id,
        appointmentId: appt.id,
      });
      await createNotification({
        companyId: appt.companyId,
        title: "✅ Cliente confirmou o horário",
        message: `${appointmentClientName(appt)} confirmou o horário de ${formatDate(appt.appointmentDate)} às ${formatTime(appt.startTime)} com ${appt.barber.name}.`,
        type: "APPOINTMENT_CONFIRMED",
        relatedEntityType: "appointment",
        relatedEntityId: appt.id,
      });
      revalidatePath("/admin/appointments");
      revalidatePath("/admin/dashboard");
    }
    return actionSuccess({ alreadyConfirmed });
  } catch (error) {
    return actionError(error);
  }
}

/** "Não vou poder ir": cancela o horário (libera a vaga e dispara a lista de espera, como qualquer cancelamento). */
export async function declineAppointmentByTokenAction(token: string): Promise<ActionResult> {
  try {
    const appt = await loadByToken(token);
    await cancelAppointmentCore(appt.id, appt.companyId, null);
    await logAudit({
      companyId: appt.companyId,
      action: "appointment_client_declined",
      entityType: "appointment",
      entityId: appt.id,
      appointmentId: appt.id,
    });
    revalidatePath("/admin/appointments");
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}
