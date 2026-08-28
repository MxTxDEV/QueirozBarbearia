"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
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

async function createAppointmentCore(
  input: CreateAppointmentInput,
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createSchema.parse(input);

    const [customer, barber, services] = await Promise.all([
      prisma.customer.findFirst({ where: { id: data.customerId, companyId } }),
      prisma.barber.findFirst({ where: { id: data.barberId, companyId } }),
      prisma.service.findMany({ where: { id: { in: data.serviceIds }, companyId, active: true } }),
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

    // Isolamento Serializable: sob o nível padrão (Read Committed), duas
    // requisições concorrentes poderiam ambas passar pela checagem de
    // conflito antes que qualquer uma inserisse sua linha, resultando em
    // double-booking do mesmo barbeiro/horário. Serializable faz o Postgres
    // detectar esse conflito e abortar uma das transações (P2034), tratado
    // abaixo como o mesmo erro amigável de horário indisponível.
    const appointment = await prisma.$transaction(
      async (tx) => {
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
            companyId,
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await logAudit({
      action: "appointment_created",
      entityType: "appointment",
      entityId: appointment.id,
      appointmentId: appointment.id,
      metadata: { customerId: customer.id, barberId: barber.id, totalPrice },
    });

    await createNotification({
      companyId,
      title: "🔔 Novo agendamento",
      message: `${customer.fullName} solicitou horário com ${barber.name} em ${formatDate(appointmentDate)} às ${formatTime(startTime)}.`,
      type: "NEW_APPOINTMENT",
      relatedEntityType: "appointment",
      relatedEntityId: appointment.id,
    });

    await sendNewAppointmentAlertToShop(companyId, {
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
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
  return createAppointmentCore({ ...input, customerId: customer.id }, customer.companyId);
}

/** Usado pelo painel administrativo, onde o admin escolhe o cliente manualmente. */
export async function createAppointmentAsAdmin(input: CreateAppointmentInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireAdminContext();
  return createAppointmentCore(input, user.companyId);
}

async function loadAppointmentContext(appointmentId: string, companyId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
    include: { customer: true, barber: true, services: true },
  });
}

export async function confirmAppointmentAction(appointmentId: string) {
  const user = await requireAdminContext();
  const appt = await loadAppointmentContext(appointmentId, user.companyId);
  if (!appt) throw new Error("Agendamento não encontrado.");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  await logAudit({ userId: user.id, action: "appointment_confirmed", entityType: "appointment", entityId: appointmentId, appointmentId });

  await createNotification({
    companyId: user.companyId,
    title: "Agendamento confirmado",
    message: `Agendamento de ${appt.customer.fullName} confirmado para ${formatDate(appt.appointmentDate)}.`,
    type: "APPOINTMENT_CONFIRMED",
    relatedEntityType: "appointment",
    relatedEntityId: appointmentId,
  });

  await sendAppointmentConfirmation(user.companyId, appt.customer.whatsapp, appt.customer.id, {
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

export async function cancelAppointmentAdminAction(appointmentId: string, formData?: FormData) {
  const user = await requireAdminContext();
  await cancelAppointmentCore(appointmentId, user.companyId, user.id);
  void formData;
}

export async function cancelAppointmentAsCustomerAction(appointmentId: string): Promise<ActionResult> {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return actionError(new Error("Sessão expirada."));
    const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, companyId: customer.companyId } });
    if (!appt || appt.customerId !== customer.id) return actionError(new Error("Agendamento não encontrado."));
    if (appt.status === "COMPLETED" || appt.status === "CANCELLED") {
      return actionError(new Error("Este agendamento não pode mais ser cancelado."));
    }
    await cancelAppointmentCore(appointmentId, customer.companyId, null);
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

async function cancelAppointmentCore(appointmentId: string, companyId: string, byUserId: string | null) {
  const appt = await loadAppointmentContext(appointmentId, companyId);
  if (!appt) throw new Error("Agendamento não encontrado.");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await logAudit({ userId: byUserId, action: "appointment_cancelled", entityType: "appointment", entityId: appointmentId, appointmentId });

  await createNotification({
    companyId,
    title: "Agendamento cancelado",
    message: `Agendamento de ${appt.customer.fullName} em ${formatDate(appt.appointmentDate)} foi cancelado.`,
    type: "APPOINTMENT_CANCELLED",
    relatedEntityType: "appointment",
    relatedEntityId: appointmentId,
  });

  await sendAppointmentCancellation(companyId, appt.customer.whatsapp, appt.customer.id, {
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
  const result = await prisma.appointment.updateMany({
    where: { id: appointmentId, companyId: user.companyId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Agendamento não encontrado.");
  await logAudit({ userId: user.id, action: "appointment_completed", entityType: "appointment", entityId: appointmentId, appointmentId });
  revalidatePath("/admin/appointments");
}

export async function markNoShowAction(appointmentId: string) {
  const user = await requireAdminContext();
  const result = await prisma.appointment.updateMany({
    where: { id: appointmentId, companyId: user.companyId },
    data: { status: "NO_SHOW" },
  });
  if (result.count === 0) throw new Error("Agendamento não encontrado.");
  await logAudit({ userId: user.id, action: "appointment_no_show", entityType: "appointment", entityId: appointmentId, appointmentId });
  revalidatePath("/admin/appointments");
}
