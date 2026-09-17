"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminContext } from "@/lib/require-admin";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { dateOnly } from "@/lib/availability";
import {
  createRecurringAppointmentCore,
  approveRecurringAppointmentCore,
  rejectRecurringAppointmentCore,
  cancelOccurrenceCore,
  editOccurrenceCore,
  editFutureOccurrencesCore,
  pauseRecurringAppointmentCore,
  resumeRecurringAppointmentCore,
  cancelRecurringAppointmentCore,
} from "@/lib/recurring-engine";
import { actionError, type ActionResult } from "@/lib/action-helpers";

const ADMIN_PATH = "/admin/recurring-appointments";
const PORTAL_PATH = "/portal/[company]";

function revalidateRecurring() {
  revalidatePath(ADMIN_PATH);
  revalidatePath(PORTAL_PATH, "layout");
}

const createRecurringSchema = z.object({
  barberId: z.string().min(1, "Selecione um barbeiro."),
  serviceId: z.string().min(1, "Selecione um serviço."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  frequencyUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]),
  intervalValue: z.coerce.number().int().min(1, "Intervalo inválido.").max(365, "Intervalo muito grande."),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  occurrencesLimit: z.coerce
    .number()
    .int()
    .min(1, "Quantidade inválida.")
    .max(104, "Máximo de 104 ocorrências.")
    .nullable()
    .optional(),
});

export type CreateRecurringAppointmentInput = z.infer<typeof createRecurringSchema>;

/** Cliente solicita — nasce PENDING_APPROVAL, nunca ativa ocorrências imediatamente (regra fundamental do pedido). */
export async function requestRecurringAppointmentAsCustomerAction(
  input: CreateRecurringAppointmentInput
): Promise<ActionResult<{ id: string }>> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada. Faça login novamente."));
  try {
    const data = createRecurringSchema.parse(input);
    const result = await createRecurringAppointmentCore({
      companyId: customer.companyId,
      customerId: customer.id,
      barberId: data.barberId,
      serviceId: data.serviceId,
      startDate: dateOnly(new Date(`${data.startDate}T00:00:00.000Z`)),
      startTime: data.startTime,
      frequencyUnit: data.frequencyUnit,
      intervalValue: data.intervalValue,
      endDate: data.endDate ? dateOnly(new Date(`${data.endDate}T00:00:00.000Z`)) : null,
      occurrencesLimit: data.occurrencesLimit ?? null,
    });
    if (result.ok) revalidateRecurring();
    return result;
  } catch (error) {
    return actionError(error);
  }
}

const createRecurringAsAdminSchema = createRecurringSchema.extend({
  customerId: z.string().min(1, "Selecione um cliente."),
});

/** Admin/barbeiro cria em nome do cliente — aprovação implícita (ver nota em createRecurringAppointmentCore). */
export async function createRecurringAppointmentAsAdminAction(
  input: z.infer<typeof createRecurringAsAdminSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAdminContext();
  try {
    const data = createRecurringAsAdminSchema.parse(input);
    const result = await createRecurringAppointmentCore({
      companyId: user.companyId,
      customerId: data.customerId,
      barberId: data.barberId,
      serviceId: data.serviceId,
      startDate: dateOnly(new Date(`${data.startDate}T00:00:00.000Z`)),
      startTime: data.startTime,
      frequencyUnit: data.frequencyUnit,
      intervalValue: data.intervalValue,
      endDate: data.endDate ? dateOnly(new Date(`${data.endDate}T00:00:00.000Z`)) : null,
      occurrencesLimit: data.occurrencesLimit ?? null,
      createdByUserId: user.id,
    });
    if (result.ok) revalidateRecurring();
    return result;
  } catch (error) {
    return actionError(error);
  }
}

export async function approveRecurringAppointmentAction(
  recurringAppointmentId: string,
  options: { occurrenceIds?: string[] | null; enrollConflictsInWaitlist: boolean }
): Promise<ActionResult<{ confirmedCount: number; conflictCount: number; waitingListCount: number }>> {
  const user = await requireAdminContext();
  const result = await approveRecurringAppointmentCore({
    recurringAppointmentId,
    companyId: user.companyId,
    approvedByUserId: user.id,
    occurrenceIds: options.occurrenceIds ?? null,
    enrollConflictsInWaitlist: options.enrollConflictsInWaitlist,
  });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function rejectRecurringAppointmentAction(recurringAppointmentId: string, reason: string): Promise<ActionResult> {
  const user = await requireAdminContext();
  if (!reason || reason.trim().length < 3) return actionError(new Error("Informe o motivo da recusa."));
  const result = await rejectRecurringAppointmentCore({
    recurringAppointmentId,
    companyId: user.companyId,
    rejectedByUserId: user.id,
    reason: reason.trim(),
  });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function cancelOccurrenceAsCustomerAction(occurrenceId: string): Promise<ActionResult> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada."));
  const result = await cancelOccurrenceCore({
    occurrenceId,
    companyId: customer.companyId,
    actorUserId: null,
    actorCustomerId: customer.id,
  });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function adminCancelOccurrenceAction(occurrenceId: string): Promise<ActionResult> {
  const user = await requireAdminContext();
  const result = await cancelOccurrenceCore({
    occurrenceId,
    companyId: user.companyId,
    actorUserId: user.id,
    actorCustomerId: null,
  });
  if (result.ok) revalidateRecurring();
  return result;
}

const editOccurrenceSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  newStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
});

export async function adminEditOccurrenceAction(
  occurrenceId: string,
  input: z.infer<typeof editOccurrenceSchema>
): Promise<ActionResult<{ status: "CONFIRMED" | "CONFLICT" | "WAITING_LIST" }>> {
  const user = await requireAdminContext();
  try {
    const data = editOccurrenceSchema.parse(input);
    const result = await editOccurrenceCore({
      occurrenceId,
      companyId: user.companyId,
      newDate: dateOnly(new Date(`${data.newDate}T00:00:00.000Z`)),
      newStartTime: data.newStartTime,
      actorUserId: user.id,
      actorCustomerId: null,
    });
    if (result.ok) revalidateRecurring();
    return result;
  } catch (error) {
    return actionError(error);
  }
}

export async function adminEditFutureOccurrencesAction(
  recurringAppointmentId: string,
  fromOccurrenceId: string,
  newStartTime: string
): Promise<ActionResult<{ regenerated: number }>> {
  const user = await requireAdminContext();
  if (!/^\d{2}:\d{2}$/.test(newStartTime)) return actionError(new Error("Horário inválido."));
  const result = await editFutureOccurrencesCore({
    recurringAppointmentId,
    companyId: user.companyId,
    fromOccurrenceId,
    newStartTime,
    actorUserId: user.id,
  });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function pauseRecurringAppointmentAsCustomerAction(recurringAppointmentId: string): Promise<ActionResult> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada."));
  const result = await pauseRecurringAppointmentCore({ recurringAppointmentId, companyId: customer.companyId, actorUserId: null });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function adminPauseRecurringAppointmentAction(recurringAppointmentId: string): Promise<ActionResult> {
  const user = await requireAdminContext();
  const result = await pauseRecurringAppointmentCore({ recurringAppointmentId, companyId: user.companyId, actorUserId: user.id });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function resumeRecurringAppointmentAsCustomerAction(recurringAppointmentId: string): Promise<ActionResult> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada."));
  const result = await resumeRecurringAppointmentCore({ recurringAppointmentId, companyId: customer.companyId, actorUserId: null });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function adminResumeRecurringAppointmentAction(recurringAppointmentId: string): Promise<ActionResult> {
  const user = await requireAdminContext();
  const result = await resumeRecurringAppointmentCore({ recurringAppointmentId, companyId: user.companyId, actorUserId: user.id });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function cancelRecurringAppointmentAsCustomerAction(
  recurringAppointmentId: string,
  alsoCancelFutureAppointments: boolean
): Promise<ActionResult<{ appointmentsCancelled: number }>> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada."));
  const result = await cancelRecurringAppointmentCore({
    recurringAppointmentId,
    companyId: customer.companyId,
    actorUserId: null,
    actorCustomerId: customer.id,
    alsoCancelFutureAppointments,
  });
  if (result.ok) revalidateRecurring();
  return result;
}

export async function adminCancelRecurringAppointmentAction(
  recurringAppointmentId: string,
  alsoCancelFutureAppointments: boolean
): Promise<ActionResult<{ appointmentsCancelled: number }>> {
  const user = await requireAdminContext();
  const result = await cancelRecurringAppointmentCore({
    recurringAppointmentId,
    companyId: user.companyId,
    actorUserId: user.id,
    actorCustomerId: null,
    alsoCancelFutureAppointments,
  });
  if (result.ok) revalidateRecurring();
  return result;
}
