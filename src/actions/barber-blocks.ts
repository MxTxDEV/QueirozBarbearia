"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext, type CompanyUser } from "@/lib/require-admin";
import { dateOnly, timeOnDate } from "@/lib/availability";
import { findAndOfferNextCandidate } from "@/lib/waitlist-engine";
import { formatTime } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

// Mesmo conjunto usado como "agendamento ativo" em src/lib/availability.ts —
// um agendamento ativo dentro da janela de um novo bloqueio tem que ser
// tratado explicitamente (nunca cancelado sozinho, ver Regra 27).
const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

/**
 * Barbeiro só gerencia bloqueios da própria agenda; ADMIN gerencia
 * qualquer barbeiro da empresa. Validado sempre no backend — nunca confiar
 * só no que o frontend esconde/mostra.
 */
async function assertCanManageBarberBlocks(user: CompanyUser, barberId: string) {
  const barber = await prisma.barber.findFirst({ where: { id: barberId, companyId: user.companyId } });
  if (!barber) throw new Error("Barbeiro não encontrado.");
  if (user.role === "BARBER" && barber.userId !== user.id) {
    throw new Error("Você só pode gerenciar bloqueios da própria agenda.");
  }
  return barber;
}

const blockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inicial inválido."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário final inválido."),
  reason: z.string().optional().or(z.literal("")),
});

async function validateAndBuildBlockWindow(
  barberId: string,
  data: z.infer<typeof blockSchema>,
  excludeBlockId?: string
): Promise<{ ok: true; day: Date; startTime: Date; endTime: Date } | { ok: false; error: string }> {
  const day = dateOnly(new Date(`${data.date}T00:00:00.000Z`));
  const startTime = timeOnDate(day, data.startTime);
  const endTime = timeOnDate(day, data.endTime);

  // Regra 25: início >= fim é sempre inválido — isso também descarta, por
  // construção, qualquer tentativa de bloqueio que atravesse a meia-noite
  // (início e fim vivem sempre no mesmo dia aqui).
  if (startTime >= endTime) {
    return { ok: false, error: "O horário final precisa ser depois do horário inicial." };
  }

  // Regra 26: sobreposição com outro bloqueio do mesmo barbeiro, convenção [start, end).
  const overlappingBlock = await prisma.barberBlock.findFirst({
    where: {
      barberId,
      date: day,
      id: excludeBlockId ? { not: excludeBlockId } : undefined,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlappingBlock) {
    return { ok: false, error: `Já existe um bloqueio nesse período (${formatTime(overlappingBlock.startTime)}–${formatTime(overlappingBlock.endTime)}).` };
  }

  // Regra 27: nunca apagar/cancelar agendamento silenciosamente — só recusa e informa.
  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      barberId,
      appointmentDate: day,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: { customer: true },
    take: 5,
  });
  if (affectedAppointments.length > 0) {
    const names = affectedAppointments.map((a) => `${a.customer.fullName} às ${formatTime(a.startTime)}`).join(", ");
    return {
      ok: false,
      error: `Não é possível bloquear: há agendamento(s) nesse período (${names}). Cancele ou remarque antes de bloquear.`,
    };
  }

  // Regra 28: reserva temporária (HOLD) ativa da lista de espera no período.
  const activeHold = await prisma.waitlistEntry.findFirst({
    where: {
      offeredBarberId: barberId,
      status: "OFFERED",
      holdExpiresAt: { gt: new Date() },
      offeredStartTime: { lt: endTime },
      offeredEndTime: { gt: startTime },
    },
  });
  if (activeHold) {
    return {
      ok: false,
      error: "Há uma reserva temporária da lista de espera em andamento nesse período. Tente novamente em alguns minutos.",
    };
  }

  return { ok: true, day, startTime, endTime };
}

export async function createBarberBlockAction(barberId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    await assertCanManageBarberBlocks(user, barberId);
    const data = blockSchema.parse({
      date: formData.get("date"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      reason: formData.get("reason"),
    });

    const window = await validateAndBuildBlockWindow(barberId, data);
    if (!window.ok) return actionError(new Error(window.error));

    const block = await prisma.barberBlock.create({
      data: {
        companyId: user.companyId,
        barberId,
        date: window.day,
        startTime: window.startTime,
        endTime: window.endTime,
        reason: data.reason || null,
        createdByUserId: user.id,
      },
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "barber_block_created",
      entityType: "barber_block",
      entityId: block.id,
      metadata: { barberId, date: data.date, startTime: data.startTime, endTime: data.endTime },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/admin/barbers/${barberId}`);
  return actionSuccess();
}

export async function updateBarberBlockAction(
  barberId: string,
  blockId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    await assertCanManageBarberBlocks(user, barberId);
    const existing = await prisma.barberBlock.findFirst({ where: { id: blockId, barberId } });
    if (!existing) return actionError(new Error("Bloqueio não encontrado."));

    const data = blockSchema.parse({
      date: formData.get("date"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      reason: formData.get("reason"),
    });

    const window = await validateAndBuildBlockWindow(barberId, data, blockId);
    if (!window.ok) return actionError(new Error(window.error));

    await prisma.barberBlock.update({
      where: { id: blockId },
      data: { date: window.day, startTime: window.startTime, endTime: window.endTime, reason: data.reason || null },
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "barber_block_updated",
      entityType: "barber_block",
      entityId: blockId,
      metadata: { barberId, date: data.date, startTime: data.startTime, endTime: data.endTime },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/admin/barbers/${barberId}`);
  return actionSuccess();
}

export async function deleteBarberBlockAction(barberId: string, blockId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    await assertCanManageBarberBlocks(user, barberId);

    const existing = await prisma.barberBlock.findFirst({ where: { id: blockId, barberId } });
    if (!existing) return actionError(new Error("Bloqueio não encontrado."));

    await prisma.barberBlock.delete({ where: { id: blockId } });
    await logAudit({ companyId: user.companyId, userId: user.id, action: "barber_block_deleted", entityType: "barber_block", entityId: blockId });

    // Remover um bloqueio também libera capacidade — vale a pena checar a
    // lista de espera, mesma lógica de um cancelamento de agendamento.
    await findAndOfferNextCandidate(user.companyId, barberId, existing.date).catch((error) => {
      console.error("[waitlist] falha ao processar vaga liberada por remoção de bloqueio:", error);
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/admin/barbers/${barberId}`);
  return actionSuccess();
}
