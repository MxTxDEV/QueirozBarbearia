"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { hasSchedulingConflict } from "@/lib/availability";
import { toNumber } from "@/lib/serialize";
import { createNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import {
  sendAppointmentCancellation,
  sendAppointmentConfirmation,
  sendNewAppointmentAlertToShop,
} from "@/lib/whatsapp";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const createSchema = z.object({
  customerId: z.string().min(1),
  barberId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um serviço."),
  startTimeIso: z.string().min(1),
  notes: z.string().optional(),
});

type CreateAppointmentInput = z.infer<typeof createSchema>;

async function createAppointmentCore(input: CreateAppointmentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createSchema.parse(input);

    const [customer, barber, services] = await Promise.all([
      prisma.customer.findUnique({ where: { id: data.customerId } }),
      prisma.barber.findUnique({ where: { id: data.barberId } }),
      prisma.service.findMany({ where: { id: { in: data.serviceIds }, active: true } }),
    ]);

    if (!customer) return actionError(new Error("Cliente não encontrado."));
    if (!barber || !barber.active) return actionError(new Error("Barbeiro indisponível."));
    if (services.length !== data.serviceIds.length) return actionError(new Error("Um ou mais serviços não estão disponíveis."));

    const totalPrice = services.reduce((sum, s) => sum + toNumber(s.price), 0);
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

    const startTime = new Date(data.startTimeIso);
    const endTime = new Date(startTime.getTime() + totalDuration * 60_000);
    const appointmentDate = new Date(Date.UTC(startTime.getUTCFullYear(), startTime.getUTCMonth(), startTime.getUTCDate()));

    if (startTime.getTime() < Date.now() - 60_000) {
      return actionError(new Error("Não é possível agendar em um horário no passado."));
    }

    const conflict = await hasSchedulingConflict({ barberId: data.barberId, startTime, endTime });
    if (conflict) {
      return actionError(new Error("Esse horário acabou de ser reservado por outro cliente. Escolha outro horário."));
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const conflictInTx = await tx.appointment.findFirst({
        where: {
          barberId: data.barberId,
          appointmentDate,
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflictInTx) throw new Error("CONFLICT");

      return tx.appointment.create({
        data: {
          customerId: data.customerId,
          barberId: data.barberId,
          appointmentDate,
          startTime,
          endTime,
          totalPrice,
          totalDurationMin: totalDuration,
          status: "PENDING",
          notes: data.notes || undefined,
          services: {
            create: services.map((s) => ({
              serviceId: s.id,
              serviceName: s.name,
              priceAtBooking: s.price,
              durationAtBooking: s.durationMinutes,
            })),
          },
        },
      });
    });

    await logAudit({
      action: "appointment_created",
      entityType: "appointment",
      entityId: appointment.id,
      appointmentId: appointment.id,
      metadata: { customerId: customer.id, barberId: barber.id, totalPrice },
    });

    await createNotification({
      title: "🔔 Novo agendamento",
      message: `${customer.fullName} solicitou horário com ${barber.name} em ${formatDate(appointmentDate)} às ${formatTime(startTime)}.`,
      type: "NEW_APPOINTMENT",
      relatedEntityType: "appointment",
      relatedEntityId: appointment.id,
    });

    await sendNewAppointmentAlertToShop({
      customerName: customer.fullName,
      date: formatDate(appointmentDate),
      time: formatTime(startTime),
      barberName: barber.name,
      services: services.map((s) => s.name),
      totalPrice: totalPrice.toFixed(2),
      status: "Aguardando confirmação",
    });

    revalidatePath("/admin/appointments");
    revalidatePath("/portal/dashboard");
    revalidatePath("/portal/appointments");

    return actionSuccess({ id: appointment.id });
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return actionError(new Error("Esse horário acabou de ser reservado por outro cliente. Escolha outro horário."));
    }
    return actionError(error);
  }
}

/** Usado pelo portal do cliente — o customerId vem da sessão autenticada, nunca do cliente. */
export async function createAppointmentAsCustomer(
  input: Omit<CreateAppointmentInput, "customerId">
): Promise<ActionResult<{ id: string }>> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada. Faça login novamente."));
  return createAppointmentCore({ ...input, customerId: customer.id });
}

/** Usado pelo painel administrativo, onde o admin escolhe o cliente manualmente. */
export async function createAppointmentAsAdmin(input: CreateAppointmentInput): Promise<ActionResult<{ id: string }>> {
  await requireAdminContext();
  return createAppointmentCore(input);
}

async function loadAppointmentContext(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { customer: true, barber: true, services: true },
  });
}

export async function confirmAppointmentAction(appointmentId: string) {
  const user = await requireAdminContext();
  const appt = await loadAppointmentContext(appointmentId);
  if (!appt) throw new Error("Agendamento não encontrado.");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  await logAudit({ userId: user.id, action: "appointment_confirmed", entityType: "appointment", entityId: appointmentId, appointmentId });

  await createNotification({
    title: "Agendamento confirmado",
    message: `Agendamento de ${appt.customer.fullName} confirmado para ${formatDate(appt.appointmentDate)}.`,
    type: "APPOINTMENT_CONFIRMED",
    relatedEntityType: "appointment",
    relatedEntityId: appointmentId,
  });

  await sendAppointmentConfirmation(appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName),
    totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
  });

  revalidatePath("/admin/appointments");
  revalidatePath("/portal/dashboard");
  revalidatePath("/portal/appointments");
}

const cancelSchema = z.object({ reason: z.string().optional() });

export async function cancelAppointmentAdminAction(appointmentId: string, formData?: FormData) {
  const user = await requireAdminContext();
  await cancelAppointmentCore(appointmentId, user.id);
  void formData;
}

export async function cancelAppointmentAsCustomerAction(appointmentId: string): Promise<ActionResult> {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return actionError(new Error("Sessão expirada."));
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt || appt.customerId !== customer.id) return actionError(new Error("Agendamento não encontrado."));
    if (appt.status === "COMPLETED" || appt.status === "CANCELLED") {
      return actionError(new Error("Este agendamento não pode mais ser cancelado."));
    }
    await cancelAppointmentCore(appointmentId, null);
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

async function cancelAppointmentCore(appointmentId: string, byUserId: string | null) {
  const appt = await loadAppointmentContext(appointmentId);
  if (!appt) throw new Error("Agendamento não encontrado.");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await logAudit({ userId: byUserId, action: "appointment_cancelled", entityType: "appointment", entityId: appointmentId, appointmentId });

  await createNotification({
    title: "Agendamento cancelado",
    message: `Agendamento de ${appt.customer.fullName} em ${formatDate(appt.appointmentDate)} foi cancelado.`,
    type: "APPOINTMENT_CANCELLED",
    relatedEntityType: "appointment",
    relatedEntityId: appointmentId,
  });

  await sendAppointmentCancellation(appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
  });

  revalidatePath("/admin/appointments");
  revalidatePath("/portal/dashboard");
  revalidatePath("/portal/appointments");
}

export async function completeAppointmentAction(appointmentId: string) {
  const user = await requireAdminContext();
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await logAudit({ userId: user.id, action: "appointment_completed", entityType: "appointment", entityId: appointmentId, appointmentId });
  revalidatePath("/admin/appointments");
}

export async function markNoShowAction(appointmentId: string) {
  const user = await requireAdminContext();
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "NO_SHOW" } });
  await logAudit({ userId: user.id, action: "appointment_no_show", entityType: "appointment", entityId: appointmentId, appointmentId });
  revalidatePath("/admin/appointments");
}
