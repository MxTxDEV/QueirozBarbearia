"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { dateOnly, timeOnDate } from "@/lib/availability";
import { createAppointmentCore } from "@/actions/appointments";
import { findAndOfferNextCandidate, expireHoldAndRematch } from "@/lib/waitlist-engine";
import { logAudit } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const joinSchema = z.object({
  serviceId: z.string().min(1, "Selecione um serviço."),
  barberId: z.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  toleranceMinutes: z.coerce.number().int().min(0, "Tolerância inválida.").max(240, "Tolerância máxima de 4 horas."),
});

export type JoinWaitlistInput = z.infer<typeof joinSchema>;

/**
 * Entra na lista de espera. companyId sempre vem de quem chama (sessão do
 * cliente ou do admin), nunca do formulário — mesmo padrão de
 * createAppointmentCore em src/actions/appointments.ts. Exportado também
 * pra ser reaproveitado quando uma ocorrência recorrente (Regra 21) cai na
 * lista de espera em vez de virar agendamento — mesmo motor, sem
 * implementação paralela.
 */
export async function joinWaitlistCore(
  input: JoinWaitlistInput,
  companyId: string,
  customerId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = joinSchema.parse(input);
    const day = dateOnly(new Date(`${data.date}T00:00:00.000Z`));
    const preferredTime = timeOnDate(day, data.preferredTime);
    const barberId = data.barberId || null;

    if (preferredTime.getTime() < Date.now() - 24 * 60 * 60_000) {
      return actionError(new Error("Não é possível entrar na lista de espera para uma data já passada."));
    }

    const [service, barber] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, companyId, active: true } }),
      barberId ? prisma.barber.findFirst({ where: { id: barberId, companyId, active: true } }) : Promise.resolve(undefined),
    ]);
    if (!service) return actionError(new Error("Serviço indisponível."));
    if (barberId && !barber) return actionError(new Error("Barbeiro indisponível."));

    // Regra 4 (duplicidade): a unique constraint no banco cobre o caso
    // barberId preenchido; Postgres trata NULL como distinto em unique
    // constraints, então "qualquer barbeiro" (barberId nulo) precisa desta
    // checagem explícita aqui também.
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        companyId,
        customerId,
        serviceId: data.serviceId,
        barberId,
        date: day,
        preferredTime,
        status: { in: ["WAITING", "OFFERED"] },
      },
    });
    if (existing) return actionError(new Error("Você já está na lista de espera para esse horário."));

    const entry = await prisma.waitlistEntry.create({
      data: {
        companyId,
        customerId,
        serviceId: data.serviceId,
        barberId,
        date: day,
        preferredTime,
        toleranceMinutes: data.toleranceMinutes,
        status: "WAITING",
      },
    });

    await logAudit({
      companyId,
      action: "waitlist_entry_created",
      entityType: "waitlist_entry",
      entityId: entry.id,
      metadata: { customerId, serviceId: data.serviceId, barberId, date: data.date, preferredTime: data.preferredTime },
    });

    revalidatePath("/admin/waitlist");
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess({ id: entry.id });
  } catch (error) {
    // Rede de segurança contra corrida na criação (dois cliques quase
    // simultâneos) — a unique constraint do banco pega o que a checagem
    // acima (feita fora de uma transação) poderia deixar passar.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return actionError(new Error("Você já está na lista de espera para esse horário."));
    }
    return actionError(error);
  }
}

export async function joinWaitlistAsCustomerAction(
  input: JoinWaitlistInput
): Promise<ActionResult<{ id: string }>> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada. Faça login novamente."));
  return joinWaitlistCore(input, customer.companyId, customer.id);
}

/** Exportado pro cancelamento de ocorrência recorrente reaproveitar (mesmo motor, sem duplicar). */
export async function cancelWaitlistEntryCore(entryId: string, companyId: string, customerId: string | null): Promise<ActionResult> {
  try {
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id: entryId, companyId, ...(customerId ? { customerId } : {}) },
    });
    if (!entry) return actionError(new Error("Entrada não encontrada."));
    if (entry.status === "CONFIRMED" || entry.status === "CANCELLED" || entry.status === "EXPIRED") {
      return actionError(new Error("Esta entrada não está mais ativa."));
    }

    const wasOffered = entry.status === "OFFERED";
    await prisma.waitlistEntry.update({
      where: { id: entryId },
      data: {
        status: "CANCELLED",
        offeredBarberId: null,
        offeredStartTime: null,
        offeredEndTime: null,
        holdExpiresAt: null,
      },
    });

    await logAudit({ companyId, action: "waitlist_entry_cancelled", entityType: "waitlist_entry", entityId: entryId });

    // Se tinha um HOLD ativo, a vaga foi liberada agora — oferece ao
    // próximo da fila em vez de esperar o cron de expiração.
    if (wasOffered && entry.offeredBarberId) {
      await findAndOfferNextCandidate(companyId, entry.offeredBarberId, entry.date).catch((error) => {
        console.error("[waitlist] falha ao reprocessar vaga liberada por cancelamento de entrada:", error);
      });
    }

    revalidatePath("/admin/waitlist");
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelWaitlistEntryAsCustomerAction(entryId: string): Promise<ActionResult> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada."));
  return cancelWaitlistEntryCore(entryId, customer.companyId, customer.id);
}

export async function adminCancelWaitlistEntryAction(entryId: string): Promise<ActionResult> {
  const user = await requireAdminContext();
  return cancelWaitlistEntryCore(entryId, user.companyId, null);
}

/**
 * Confirma uma oferta ativa. Revalida tudo de novo no servidor (Regra de
 * segurança da confirmação): a oferta ainda existe e é OFFERED, o prazo não
 * venceu, e — no fluxo do cliente — que ele é o dono da entrada (companyId
 * e customerId vêm da sessão validada, nunca do formulário). Cria o
 * agendamento de verdade reaproveitando createAppointmentCore (fluxo normal
 * de agendamento), excluindo o próprio HOLD da checagem de conflito.
 */
async function confirmWaitlistOfferCore(
  entryId: string,
  companyId: string,
  customerId: string | null
): Promise<ActionResult<{ appointmentId: string }>> {
  try {
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id: entryId, companyId, ...(customerId ? { customerId } : {}) },
    });
    if (!entry) return actionError(new Error("Oferta não encontrada."));
    if (entry.status !== "OFFERED") {
      return actionError(new Error("Esta oferta não está mais disponível."));
    }
    if (!entry.holdExpiresAt || entry.holdExpiresAt <= new Date()) {
      // Reconhecimento "ao vivo" de expiração (Regra 37): mesmo que o cron
      // de expiração ainda não tenha rodado, o sistema já trata como
      // vencido aqui e libera a vaga pro próximo candidato agora mesmo.
      await expireHoldAndRematch({ id: entry.id, companyId, offeredBarberId: entry.offeredBarberId, date: entry.date });
      return actionError(new Error("O prazo para confirmar esta oferta expirou. Você foi mantido na lista de espera."));
    }
    if (!entry.offeredBarberId || !entry.offeredStartTime) {
      return actionError(new Error("Oferta inválida."));
    }

    const created = await createAppointmentCore(
      {
        customerId: entry.customerId,
        barberId: entry.offeredBarberId,
        serviceIds: [entry.serviceId],
        startTimeIso: entry.offeredStartTime.toISOString(),
      },
      companyId,
      { excludeWaitlistEntryId: entry.id }
    );
    if (!created.ok) return created;

    // Só chega aqui depois que createAppointmentCore, com sua própria
    // transação Serializable, já garantiu que este é o único agendamento
    // criado para esse horário — não há corrida a proteger nesta escrita.
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "CONFIRMED", confirmedAppointmentId: created.data!.id },
    });

    await logAudit({
      companyId,
      action: "waitlist_offer_confirmed",
      entityType: "waitlist_entry",
      entityId: entry.id,
      appointmentId: created.data!.id,
    });

    revalidatePath("/admin/waitlist");
    revalidatePath("/admin/appointments");
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess({ appointmentId: created.data!.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function confirmWaitlistOfferAsCustomerAction(entryId: string): Promise<ActionResult<{ appointmentId: string }>> {
  const customer = await getCurrentCustomer();
  if (!customer) return actionError(new Error("Sessão expirada."));
  return confirmWaitlistOfferCore(entryId, customer.companyId, customer.id);
}

/** Confirmação manual pelo admin (Regra 19 — "confirmar manualmente quando permitido"). */
export async function adminConfirmWaitlistOfferAction(entryId: string): Promise<ActionResult<{ appointmentId: string }>> {
  const user = await requireAdminContext();
  return confirmWaitlistOfferCore(entryId, user.companyId, null);
}
