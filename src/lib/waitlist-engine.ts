import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnly, getAvailableSlots, hasSchedulingConflict, type TimeSlot } from "@/lib/availability";
import {
  WAITLIST_HOLD_DURATION_MINUTES,
  findClosestAvailableSlot,
  rankWaitlistCandidateMatches,
  type WaitlistCandidateMatch,
} from "@/lib/waitlist-helpers";
import { createNotification } from "@/lib/notifications";
import { sendWaitlistSlotOffer } from "@/lib/whatsapp";
import { logAudit } from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/utils";

type WaitingEntry = Prisma.WaitlistEntryGetPayload<{ include: { service: true } }>;

/**
 * Tenta transformar a preferência de UM candidato numa reserva temporária
 * (HOLD) para `offeredStart`. Protegido por transação Serializable (mesmo
 * padrão de src/actions/appointments.ts): revalida disponibilidade e faz um
 * CAS (compare-and-swap via updateMany com guarda no where) de
 * WAITING→OFFERED. Se qualquer coisa mudou entre o cálculo do candidato e
 * agora — outra reserva, outro agendamento direto, ou outro processo já
 * tendo oferecido esta mesma entrada — retorna null sem lançar erro: quem
 * chamou (findAndOfferNextCandidate) simplesmente tenta o próximo da fila.
 * Isso é o que garante idempotência (rodar isso duas vezes para o mesmo
 * evento nunca cria duas ofertas) e a proteção de concorrência pedida.
 */
async function tryCreateHold(companyId: string, barberId: string, entry: WaitingEntry, offeredStart: Date) {
  const offeredEnd = new Date(offeredStart.getTime() + entry.service.durationMinutes * 60_000);
  const holdExpiresAt = new Date(Date.now() + WAITLIST_HOLD_DURATION_MINUTES * 60_000);

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const conflict = await hasSchedulingConflict(
          { barberId, startTime: offeredStart, endTime: offeredEnd, excludeWaitlistEntryId: entry.id },
          tx
        );
        if (conflict) throw new Error("SLOT_TAKEN");

        const cas = await tx.waitlistEntry.updateMany({
          where: { id: entry.id, status: "WAITING" },
          data: {
            status: "OFFERED",
            offeredBarberId: barberId,
            offeredStartTime: offeredStart,
            offeredEndTime: offeredEnd,
            holdExpiresAt,
            notifiedAt: new Date(),
          },
        });
        if (cas.count === 0) throw new Error("ALREADY_CLAIMED");

        return tx.waitlistEntry.findUniqueOrThrow({
          where: { id: entry.id },
          include: { customer: true, service: true, offeredBarber: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await logAudit({
      companyId,
      action: "waitlist_offer_created",
      entityType: "waitlist_entry",
      entityId: updated.id,
      metadata: {
        customerId: updated.customerId,
        barberId,
        offeredStartTime: offeredStart.toISOString(),
        holdExpiresAt: holdExpiresAt.toISOString(),
      },
    });

    await createNotification({
      companyId,
      title: "🟠 Vaga oferecida na lista de espera",
      message: `${updated.customer.fullName} recebeu a oferta de ${formatDate(offeredStart)} às ${formatTime(offeredStart)} com ${updated.offeredBarber!.name}.`,
      type: "WAITLIST_SLOT_OFFERED",
      relatedEntityType: "waitlist_entry",
      relatedEntityId: updated.id,
    });

    await sendWaitlistSlotOffer(companyId, updated.customer.whatsapp, updated.customer.id, {
      customerName: updated.customer.fullName,
      serviceName: updated.service.name,
      barberName: updated.offeredBarber!.name,
      date: formatDate(offeredStart),
      time: formatTime(offeredStart),
      confirmByTime: formatTime(holdExpiresAt),
    });

    return updated;
  } catch (error) {
    const isRaceLoss =
      (error instanceof Error && (error.message === "SLOT_TAKEN" || error.message === "ALREADY_CLAIMED")) ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034");
    if (isRaceLoss) return null;
    throw error;
  }
}

/**
 * Motor de compatibilidade: dado que uma vaga pode ter surgido para
 * `barberId` em `date` (cancelamento, remarcação, bloqueio removido...),
 * acha o melhor candidato WAITING compatível e cria um HOLD pra ele.
 *
 * Processa só UMA oferta por chamada (uma vaga liberada → uma oferta) — a
 * cadeia "próximo candidato" acontece por reentrada: se este HOLD expirar,
 * quem chama a expiração chama esta função de novo (ver
 * expireHoldAndRematch). Isso mantém o processamento limitado e sem
 * recursão — nunca risco de loop infinito.
 *
 * `excludeEntryId` existe especificamente para o caso de reentrada por
 * expiração: o createdAt de quem acabou de perder o HOLD não piora só por
 * ter perdido, então sem essa exclusão ele venceria a prioridade nesta
 * mesma rodada e receberia a MESMA vaga de novo — nunca passando a vez pro
 * próximo da fila (ver expireHoldAndRematch). Fora desse caso, ele volta a
 * concorrer normalmente pela próxima vaga que surgir.
 */
export async function findAndOfferNextCandidate(
  companyId: string,
  barberId: string,
  date: Date,
  options?: { excludeEntryId?: string }
) {
  const day = dateOnly(date);

  const candidates = await prisma.waitlistEntry.findMany({
    where: {
      companyId,
      date: day,
      status: "WAITING",
      OR: [{ barberId }, { barberId: null }],
      id: options?.excludeEntryId ? { not: options.excludeEntryId } : undefined,
    },
    include: { service: true },
  });
  if (candidates.length === 0) return null;

  const slotsByDuration = new Map<number, TimeSlot[]>();
  const matches: Array<{ entry: WaitingEntry; slot: TimeSlot }> = [];

  for (const entry of candidates) {
    const duration = entry.service.durationMinutes;
    let slots = slotsByDuration.get(duration);
    if (!slots) {
      slots = await getAvailableSlots({ barberId, date: day, totalDurationMinutes: duration });
      slotsByDuration.set(duration, slots);
    }
    const bestSlot = findClosestAvailableSlot(entry.preferredTime, entry.toleranceMinutes, slots);
    if (bestSlot) matches.push({ entry, slot: bestSlot });
  }
  if (matches.length === 0) return null;

  const candidateMatches: WaitlistCandidateMatch[] = matches.map(({ entry, slot }) => ({
    entryId: entry.id,
    exactTimeMatch: slot.start.getTime() === entry.preferredTime.getTime(),
    requestedThisBarber: entry.barberId === barberId,
    distanceMs: Math.abs(slot.start.getTime() - entry.preferredTime.getTime()),
    createdAt: entry.createdAt,
  }));
  const ranked = rankWaitlistCandidateMatches(candidateMatches);

  // Tenta em ordem de prioridade; se o topo perder a corrida de concorrência
  // (outro processo pegou o horário entre o cálculo e a tentativa), tenta o
  // próximo — sem isso, uma única colisão deixaria a vaga sem ser oferecida
  // a ninguém neste ciclo.
  for (const rankedMatch of ranked) {
    const match = matches.find((m) => m.entry.id === rankedMatch.entryId);
    if (!match) continue;
    const offered = await tryCreateHold(companyId, barberId, match.entry, match.slot.start);
    if (offered) return offered;
  }
  return null;
}

/**
 * Expira UM hold vencido (CAS OFFERED→WAITING) e, se conseguiu expirar de
 * fato (idempotente — se outra execução concorrente já tinha expirado esta
 * mesma entrada, count será 0 e não faz nada), dispara o motor de novo para
 * o mesmo barbeiro/data, oferecendo a vaga liberada ao próximo da fila.
 */
export async function expireHoldAndRematch(entry: { id: string; companyId: string; offeredBarberId: string | null; date: Date }) {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id: entry.id, status: "OFFERED" },
    data: { status: "WAITING", offeredBarberId: null, offeredStartTime: null, offeredEndTime: null, holdExpiresAt: null, notifiedAt: null },
  });
  if (result.count === 0) return false;

  await logAudit({ companyId: entry.companyId, action: "waitlist_offer_expired", entityType: "waitlist_entry", entityId: entry.id });

  if (entry.offeredBarberId) {
    await findAndOfferNextCandidate(entry.companyId, entry.offeredBarberId, entry.date, { excludeEntryId: entry.id });
  }
  return true;
}

/**
 * Job (cron) — varre HOLDs vencidos de todas as empresas, libera a vaga e
 * oferece ao próximo candidato compatível. Idempotente do mesmo jeito que
 * sendDueAppointmentReminders (src/lib/appointment-reminders.ts): pode
 * rodar com qualquer frequência, o CAS em expireHoldAndRematch garante que
 * cada HOLD só é processado uma vez. Antes mesmo deste job rodar, um HOLD
 * vencido já é tratado como livre por getAvailableSlots/hasSchedulingConflict
 * (filtram holdExpiresAt > agora) — este job só formaliza a transição de
 * estado e dispara a próxima oferta.
 */
export async function expireDueWaitlistHolds() {
  const due = await prisma.waitlistEntry.findMany({
    where: { status: "OFFERED", holdExpiresAt: { lte: new Date() } },
    select: { id: true, companyId: true, offeredBarberId: true, date: true },
  });

  let expired = 0;
  for (const entry of due) {
    const did = await expireHoldAndRematch(entry);
    if (did) expired++;
  }
  return { checked: due.length, expired };
}
