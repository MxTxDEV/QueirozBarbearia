import "server-only";
import { prisma } from "@/lib/prisma";
import type { Barber, Customer, RecurringAppointment, RecurringAppointmentOccurrence, Service } from "@prisma/client";
import { dateOnly, timeOnDate } from "@/lib/availability";
import { generateOccurrenceDates, RECURRING_GENERATION_HORIZON_MONTHS, describeFrequency } from "@/lib/recurring-helpers";
import { createAppointmentCore, cancelAppointmentCore } from "@/actions/appointments";
import { joinWaitlistCore, cancelWaitlistEntryCore } from "@/actions/waitlist";
import { createNotification } from "@/lib/notifications";
import { sendRecurringRequestAlertToShop, sendRecurringApproved, sendRecurringRejected } from "@/lib/whatsapp";
import { logAudit } from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/utils";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

type SeriesWithRelations = RecurringAppointment & { customer: Customer; barber: Barber; service: Service };

function occurrenceWindow(date: Date, startTimeHHMM: string, durationMinutes: number) {
  const scheduledDate = dateOnly(date);
  const scheduledStartTime = timeOnDate(scheduledDate, startTimeHHMM);
  const scheduledEndTime = new Date(scheduledStartTime.getTime() + durationMinutes * 60_000);
  return { scheduledDate, scheduledStartTime, scheduledEndTime };
}

// ---------------------------------------------------------------------------
// Prévia (só leitura) — tela de análise do barbeiro (Regra 16/17/18)
// ---------------------------------------------------------------------------

export type OccurrencePreviewStatus =
  | "AVAILABLE"
  | "APPOINTMENT_CONFLICT"
  | "BLOCKED"
  | "HOLD_CONFLICT"
  | "OUTSIDE_WORKING_HOURS";

/**
 * Checa a disponibilidade de UMA janela [start,end) sem escrever nada —
 * usada só pra prévia. Reaproveita as mesmas fontes de indisponibilidade de
 * hasSchedulingConflict (horário de funcionamento/folga, bloqueio,
 * agendamento, HOLD), mas discrimina QUAL delas bateu pra render os ícones
 * ✓/⚠/🔒 do pedido (Regra 16). A decisão que realmente vale (Regra 19: "a
 * validação da tela anterior NÃO deve ser considerada suficiente") sempre
 * roda de novo, do zero, em materializeOccurrence (via createAppointmentCore
 * → hasSchedulingConflict).
 */
export async function previewOccurrenceAvailability(barberId: string, startTime: Date, endTime: Date): Promise<OccurrencePreviewStatus> {
  const day = dateOnly(startTime);
  const weekday = day.getUTCDay();

  const workingHour = await prisma.barberWorkingHour.findUnique({
    where: { barberId_weekday: { barberId, weekday } },
  });
  if (!workingHour) return "OUTSIDE_WORKING_HOURS";

  const dayStart = timeOnDate(day, workingHour.startTime);
  const dayEnd = timeOnDate(day, workingHour.endTime);
  const withinBreak =
    workingHour.breakStart && workingHour.breakEnd
      ? startTime < timeOnDate(day, workingHour.breakEnd) && endTime > timeOnDate(day, workingHour.breakStart)
      : false;
  if (startTime < dayStart || endTime > dayEnd || withinBreak) return "OUTSIDE_WORKING_HOURS";

  const timeOff = await prisma.barberTimeOff.findFirst({
    where: { barberId, startDate: { lte: day }, endDate: { gte: day } },
  });
  if (timeOff) return "OUTSIDE_WORKING_HOURS";

  const blocking = await prisma.barberBlock.findFirst({
    where: { barberId, date: day, startTime: { lt: endTime }, endTime: { gt: startTime } },
  });
  if (blocking) return "BLOCKED";

  const conflictingAppointment = await prisma.appointment.findFirst({
    where: {
      barberId,
      appointmentDate: day,
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (conflictingAppointment) return "APPOINTMENT_CONFLICT";

  const conflictingHold = await prisma.waitlistEntry.findFirst({
    where: {
      offeredBarberId: barberId,
      status: "OFFERED",
      holdExpiresAt: { gt: new Date() },
      offeredStartTime: { lt: endTime },
      offeredEndTime: { gt: startTime },
    },
  });
  if (conflictingHold) return "HOLD_CONFLICT";

  return "AVAILABLE";
}

/** Prévia de todas as ocorrências PENDING de uma série — usada pela tela de análise (Regra 16). */
export async function previewSeriesOccurrences(recurringAppointmentId: string, companyId: string) {
  const occurrences = await prisma.recurringAppointmentOccurrence.findMany({
    where: { recurringAppointmentId, recurringAppointment: { companyId }, status: "PENDING" },
    orderBy: { occurrenceNumber: "asc" },
  });
  const series = await prisma.recurringAppointment.findFirst({ where: { id: recurringAppointmentId, companyId } });
  if (!series) return [];

  const previews = [];
  for (const occ of occurrences) {
    const status = await previewOccurrenceAvailability(series.barberId, occ.scheduledStartTime, occ.scheduledEndTime);
    previews.push({ occurrence: occ, previewStatus: status });
  }
  return previews;
}

// ---------------------------------------------------------------------------
// Materialização de uma ocorrência (aprovar / geração progressiva / retomar)
// ---------------------------------------------------------------------------

type MaterializeResult = "CONFIRMED" | "CONFLICT" | "WAITING_LIST";

/**
 * Tenta transformar UMA ocorrência PENDING num Appointment de verdade,
 * reaproveitando createAppointmentCore (Regra 25 — mesmo fluxo normal,
 * transação Serializable própria já embutida nele, sem duplicar). Se
 * indisponível, opcionalmente entra na lista de espera JÁ EXISTENTE
 * (Regra 21) em vez de qualquer implementação paralela. Nunca falha
 * silenciosamente — toda ocorrência sai daqui com um status definitivo e
 * um motivo registrado quando aplicável (Regra 17/36).
 */
async function materializeOccurrence(
  occurrence: RecurringAppointmentOccurrence,
  series: SeriesWithRelations,
  enrollConflictsInWaitlist: boolean
): Promise<MaterializeResult> {
  const created = await createAppointmentCore(
    {
      customerId: series.customerId,
      barberId: series.barberId,
      serviceIds: [series.serviceId],
      startTimeIso: occurrence.scheduledStartTime.toISOString(),
    },
    series.companyId
  );

  if (created.ok) {
    await prisma.recurringAppointmentOccurrence.update({
      where: { id: occurrence.id },
      data: { status: "CONFIRMED", appointmentId: created.data!.id, conflictReason: null },
    });
    await logAudit({
      companyId: series.companyId,
      action: "recurring_occurrence_confirmed",
      entityType: "recurring_appointment_occurrence",
      entityId: occurrence.id,
      appointmentId: created.data!.id,
    });
    return "CONFIRMED";
  }

  const conflictReason = created.error;

  // Não faz sentido entrar na lista de espera de um horário fora do
  // expediente do barbeiro (dia sem funcionamento, folga/férias) — não há
  // cancelamento algum que algum dia libere essa vaga, então isso só criaria
  // uma entrada morta. Reaproveita a mesma discriminação da prévia (Regra 21
  // só cobre o caso de "vaga ocupada", não "vaga que não existe").
  const previewStatus = await previewOccurrenceAvailability(series.barberId, occurrence.scheduledStartTime, occurrence.scheduledEndTime);

  if (enrollConflictsInWaitlist && previewStatus !== "OUTSIDE_WORKING_HOURS") {
    const joined = await joinWaitlistCore(
      {
        serviceId: series.serviceId,
        barberId: series.barberId,
        date: occurrence.scheduledDate.toISOString().slice(0, 10),
        preferredTime: series.startTime,
        toleranceMinutes: 30,
      },
      series.companyId,
      series.customerId
    );
    if (joined.ok) {
      await prisma.recurringAppointmentOccurrence.update({
        where: { id: occurrence.id },
        data: { status: "WAITING_LIST", waitlistEntryId: joined.data!.id, conflictReason },
      });
      await logAudit({
        companyId: series.companyId,
        action: "recurring_occurrence_conflict",
        entityType: "recurring_appointment_occurrence",
        entityId: occurrence.id,
        metadata: { conflictReason, waitlisted: true },
      });
      return "WAITING_LIST";
    }
  }

  await prisma.recurringAppointmentOccurrence.update({
    where: { id: occurrence.id },
    data: { status: "CONFLICT", conflictReason },
  });
  await logAudit({
    companyId: series.companyId,
    action: "recurring_occurrence_conflict",
    entityType: "recurring_appointment_occurrence",
    entityId: occurrence.id,
    metadata: { conflictReason, waitlisted: false },
  });
  await createNotification({
    companyId: series.companyId,
    title: "⚠️ Conflito em recorrência",
    message: `A ocorrência de ${series.customer.fullName} em ${formatDate(occurrence.scheduledDate)} às ${formatTime(occurrence.scheduledStartTime)} ficou indisponível.`,
    type: "RECURRING_OCCURRENCE_CONFLICT",
    relatedEntityType: "recurring_appointment_occurrence",
    relatedEntityId: occurrence.id,
  });
  return "CONFLICT";
}

// ---------------------------------------------------------------------------
// Criação da série
// ---------------------------------------------------------------------------

export type CreateRecurringParams = {
  companyId: string;
  customerId: string;
  barberId: string;
  serviceId: string;
  startDate: Date;
  startTime: string;
  frequencyUnit: "DAYS" | "WEEKS" | "MONTHS";
  intervalValue: number;
  endDate?: Date | null;
  occurrencesLimit?: number | null;
  /** Presente = criado por staff em nome do cliente → aprovação implícita (ver nota em createRecurringAppointmentCore). Ausente = solicitado pelo próprio cliente → PENDING_APPROVAL. */
  createdByUserId?: string | null;
};

/**
 * Cria a série. Regra fundamental do pedido: pedido de CLIENTE nasce
 * PENDING_APPROVAL, nunca ativa ocorrências imediatamente. Quando é o
 * próprio ADMIN/BARBER que cria (ex: organizando a agenda de um cliente no
 * balcão), a aprovação já é implícita — é a mesma pessoa que teria que
 * aprovar depois, então nasce ACTIVE direto e as ocorrências já passam
 * pela validação normal. Essa distinção não está explícita letra-por-letra
 * no pedido, mas evita um loop de "criar → aprovar a própria criação" sem
 * sentido; documentado aqui e no relatório final.
 */
export async function createRecurringAppointmentCore(params: CreateRecurringParams): Promise<ActionResult<{ id: string }>> {
  try {
    const [customer, barber, service] = await Promise.all([
      prisma.customer.findFirst({ where: { id: params.customerId, companyId: params.companyId } }),
      prisma.barber.findFirst({ where: { id: params.barberId, companyId: params.companyId, active: true } }),
      prisma.service.findFirst({ where: { id: params.serviceId, companyId: params.companyId, active: true } }),
    ]);
    if (!customer) return actionError(new Error("Cliente não encontrado."));
    if (!barber) return actionError(new Error("Barbeiro indisponível."));
    if (!service) return actionError(new Error("Serviço indisponível."));

    const startDate = dateOnly(params.startDate);
    if (startDate.getTime() < dateOnly(new Date()).getTime()) {
      return actionError(new Error("A data de início não pode estar no passado."));
    }

    const isStaffCreated = !!params.createdByUserId;
    const status = isStaffCreated ? "ACTIVE" : "PENDING_APPROVAL";

    const series = await prisma.recurringAppointment.create({
      data: {
        companyId: params.companyId,
        customerId: params.customerId,
        barberId: params.barberId,
        serviceId: params.serviceId,
        startDate,
        startTime: params.startTime,
        frequencyUnit: params.frequencyUnit,
        intervalValue: params.intervalValue,
        endDate: params.endDate ? dateOnly(params.endDate) : null,
        occurrencesLimit: params.occurrencesLimit ?? null,
        status,
        createdByUserId: params.createdByUserId ?? null,
        ...(isStaffCreated ? { approvedByUserId: params.createdByUserId, approvedAt: new Date() } : {}),
      },
    });

    const isOpenEnded = !series.occurrencesLimit && !series.endDate;
    const horizonDate = isOpenEnded ? addMonthsForHorizon(startDate) : null;

    const dates = generateOccurrenceDates({
      startDate,
      frequencyUnit: series.frequencyUnit,
      intervalValue: series.intervalValue,
      endDate: series.endDate,
      occurrencesLimit: series.occurrencesLimit,
      horizonDate,
    });

    await createOccurrenceRows(series, dates, service.durationMinutes);

    if (isOpenEnded && dates.length > 0) {
      await prisma.recurringAppointment.update({
        where: { id: series.id },
        data: { generatedUntil: dates[dates.length - 1].date },
      });
    }

    await logAudit({
      companyId: params.companyId,
      userId: params.createdByUserId ?? null,
      action: "recurring_appointment_created",
      entityType: "recurring_appointment",
      entityId: series.id,
      metadata: {
        customerId: params.customerId,
        barberId: params.barberId,
        serviceId: params.serviceId,
        frequencyUnit: params.frequencyUnit,
        intervalValue: params.intervalValue,
        occurrenceCount: dates.length,
        status,
      },
    });

    if (isStaffCreated) {
      // Já aprovada — materializa as ocorrências geradas na hora, mesma
      // lógica da aprovação manual (nenhum sistema paralelo).
      const fullSeries = { ...series, customer, barber, service };
      const pending = await prisma.recurringAppointmentOccurrence.findMany({
        where: { recurringAppointmentId: series.id, status: "PENDING" },
        orderBy: { occurrenceNumber: "asc" },
      });
      for (const occ of pending) {
        await materializeOccurrence(occ, fullSeries, true);
      }
    } else {
      await createNotification({
        companyId: params.companyId,
        title: "🔁 Nova solicitação de recorrência",
        message: `${customer.fullName} solicitou recorrência de ${service.name} com ${barber.name} — ${describeFrequency(series.frequencyUnit, series.intervalValue)}.`,
        type: "RECURRING_REQUEST",
        relatedEntityType: "recurring_appointment",
        relatedEntityId: series.id,
      });
      await sendRecurringRequestAlertToShop(params.companyId, {
        customerName: customer.fullName,
        serviceName: service.name,
        barberName: barber.name,
        time: params.startTime,
        frequencyLabel: describeFrequency(series.frequencyUnit, series.intervalValue),
        startDate: formatDate(startDate),
        occurrencesLabel: series.occurrencesLimit
          ? `Quantidade: ${series.occurrencesLimit} ocorrências`
          : series.endDate
            ? `Até: ${formatDate(series.endDate)}`
            : "Sem data final",
      });
    }

    return actionSuccess({ id: series.id });
  } catch (error) {
    return actionError(error);
  }
}

function addMonthsForHorizon(from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + RECURRING_GENERATION_HORIZON_MONTHS);
  return d;
}

async function createOccurrenceRows(series: RecurringAppointment, dates: { occurrenceIndex: number; date: Date }[], durationMinutes: number) {
  for (const { occurrenceIndex, date } of dates) {
    const window = occurrenceWindow(date, series.startTime, durationMinutes);
    await prisma.recurringAppointmentOccurrence.create({
      data: {
        recurringAppointmentId: series.id,
        occurrenceNumber: occurrenceIndex + 1,
        scheduledDate: window.scheduledDate,
        scheduledStartTime: window.scheduledStartTime,
        scheduledEndTime: window.scheduledEndTime,
        status: "PENDING",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Aprovação / rejeição (Regra 19/20/26/27/50)
// ---------------------------------------------------------------------------

export async function approveRecurringAppointmentCore(params: {
  recurringAppointmentId: string;
  companyId: string;
  approvedByUserId: string;
  /** Ausente = tenta TODAS as ocorrências PENDING ("aprovar tudo"). Presente = tenta só essas; as demais PENDING viram CONFLICT como não incluídas nesta aprovação ("aprovar disponíveis" — Regra 20). */
  occurrenceIds?: string[] | null;
  enrollConflictsInWaitlist: boolean;
}): Promise<ActionResult<{ confirmedCount: number; conflictCount: number; waitingListCount: number }>> {
  try {
    // Regra 19 passos 1-3: busca de novo, nunca confia na tela anterior.
    const series = await prisma.recurringAppointment.findFirst({
      where: { id: params.recurringAppointmentId, companyId: params.companyId },
      include: { customer: true, barber: true, service: true },
    });
    if (!series) return actionError(new Error("Recorrência não encontrada."));
    if (series.status !== "PENDING_APPROVAL") {
      return actionError(new Error("Esta recorrência já foi processada."));
    }
    if (!series.barber.active) return actionError(new Error("Barbeiro indisponível."));
    if (!series.service.active) return actionError(new Error("Serviço indisponível."));

    // CAS: reivindica a aprovação antes de tocar em qualquer ocorrência —
    // protege contra duas aprovações concorrentes da mesma série (Regra 26/50).
    const claimed = await prisma.recurringAppointment.updateMany({
      where: { id: series.id, status: "PENDING_APPROVAL" },
      data: { status: "ACTIVE", approvedByUserId: params.approvedByUserId, approvedAt: new Date() },
    });
    if (claimed.count === 0) return actionError(new Error("Esta recorrência acabou de ser processada por outra ação."));

    const allPending = await prisma.recurringAppointmentOccurrence.findMany({
      where: { recurringAppointmentId: series.id, status: "PENDING" },
      orderBy: { occurrenceNumber: "asc" },
    });

    const toAttempt = params.occurrenceIds ? allPending.filter((o) => params.occurrenceIds!.includes(o.id)) : allPending;
    const toSkip = params.occurrenceIds ? allPending.filter((o) => !params.occurrenceIds!.includes(o.id)) : [];

    let confirmedCount = 0;
    let conflictCount = 0;
    let waitingListCount = 0;

    for (const occ of toAttempt) {
      const result = await materializeOccurrence(occ, series, params.enrollConflictsInWaitlist);
      if (result === "CONFIRMED") confirmedCount++;
      else if (result === "WAITING_LIST") waitingListCount++;
      else conflictCount++;
    }

    for (const occ of toSkip) {
      await prisma.recurringAppointmentOccurrence.update({
        where: { id: occ.id },
        data: { status: "CONFLICT", conflictReason: "Não incluído nesta aprovação." },
      });
      conflictCount++;
    }

    await logAudit({
      companyId: params.companyId,
      userId: params.approvedByUserId,
      action: "recurring_appointment_approved",
      entityType: "recurring_appointment",
      entityId: series.id,
      metadata: { confirmedCount, conflictCount, waitingListCount, partial: !!params.occurrenceIds },
    });

    await createNotification({
      companyId: params.companyId,
      title: "Recorrência aprovada",
      message: `Recorrência de ${series.customer.fullName} aprovada: ${confirmedCount} confirmado(s), ${conflictCount + waitingListCount} indisponível(is).`,
      type: "RECURRING_APPROVED",
      relatedEntityType: "recurring_appointment",
      relatedEntityId: series.id,
    });
    await sendRecurringApproved(params.companyId, series.customer.whatsapp, series.customerId, {
      customerName: series.customer.fullName,
      serviceName: series.service.name,
      barberName: series.barber.name,
      frequencyLabel: describeFrequency(series.frequencyUnit, series.intervalValue),
      confirmedCount,
      conflictCount: conflictCount + waitingListCount,
    });

    return actionSuccess({ confirmedCount, conflictCount, waitingListCount });
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectRecurringAppointmentCore(params: {
  recurringAppointmentId: string;
  companyId: string;
  rejectedByUserId: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const series = await prisma.recurringAppointment.findFirst({
      where: { id: params.recurringAppointmentId, companyId: params.companyId },
      include: { customer: true, service: true },
    });
    if (!series) return actionError(new Error("Recorrência não encontrada."));

    const claimed = await prisma.recurringAppointment.updateMany({
      where: { id: series.id, status: "PENDING_APPROVAL" },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: params.reason },
    });
    if (claimed.count === 0) return actionError(new Error("Esta recorrência já foi processada."));

    await prisma.recurringAppointmentOccurrence.updateMany({
      where: { recurringAppointmentId: series.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    await logAudit({
      companyId: params.companyId,
      userId: params.rejectedByUserId,
      action: "recurring_appointment_rejected",
      entityType: "recurring_appointment",
      entityId: series.id,
      metadata: { reason: params.reason },
    });

    await createNotification({
      companyId: params.companyId,
      title: "Recorrência recusada",
      message: `Recorrência de ${series.customer.fullName} foi recusada.`,
      type: "RECURRING_REJECTED",
      relatedEntityType: "recurring_appointment",
      relatedEntityId: series.id,
    });
    await sendRecurringRejected(params.companyId, series.customer.whatsapp, series.customerId, {
      customerName: series.customer.fullName,
      serviceName: series.service.name,
      reason: params.reason,
    });

    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

// ---------------------------------------------------------------------------
// Geração progressiva (Regra 28/29) — séries ACTIVE sem fim definido
// ---------------------------------------------------------------------------

/**
 * Roda periodicamente (cron). Só se aplica a séries ACTIVE sem
 * occurrencesLimit/endDate (finitas já foram geradas por completo na
 * criação/aprovação). Estende o horizonte rolante e materializa as novas
 * ocorrências direto — a série já foi aprovada uma vez pelo barbeiro; isso
 * é o compromisso permanente aceito, não uma nova aprovação por data.
 * Idempotente: a unique constraint (recurringAppointmentId, occurrenceNumber)
 * garante que rodar duas vezes nunca duplica uma ocorrência (Regra 27).
 */
export async function generateProgressiveOccurrences() {
  const openSeries = await prisma.recurringAppointment.findMany({
    where: { status: "ACTIVE", occurrencesLimit: null, endDate: null },
    include: { customer: true, barber: true, service: true },
  });

  let seriesProcessed = 0;
  let occurrencesGenerated = 0;
  let confirmed = 0;
  let conflicts = 0;

  for (const series of openSeries) {
    try {
      const result = await generateProgressiveBatchForSeries(series);
      if (result.generated > 0) seriesProcessed++;
      occurrencesGenerated += result.generated;
      confirmed += result.confirmed;
      conflicts += result.conflicts;
    } catch (error) {
      console.error(`[recurring] falha ao gerar lote progressivo da série ${series.id}:`, error);
    }
  }

  return { seriesChecked: openSeries.length, seriesProcessed, occurrencesGenerated, confirmed, conflicts };
}

async function generateProgressiveBatchForSeries(series: SeriesWithRelations) {
  const count = await prisma.recurringAppointmentOccurrence.count({ where: { recurringAppointmentId: series.id } });
  const horizonDate = addMonthsForHorizon(dateOnly(new Date()));

  const dates = generateOccurrenceDates({
    startDate: series.startDate,
    frequencyUnit: series.frequencyUnit,
    intervalValue: series.intervalValue,
    startIndex: count,
    horizonDate,
  });

  if (dates.length === 0) return { generated: 0, confirmed: 0, conflicts: 0 };

  let confirmed = 0;
  let conflicts = 0;
  for (const { occurrenceIndex, date } of dates) {
    const window = occurrenceWindow(date, series.startTime, series.service.durationMinutes);
    let occ;
    try {
      occ = await prisma.recurringAppointmentOccurrence.create({
        data: {
          recurringAppointmentId: series.id,
          occurrenceNumber: occurrenceIndex + 1,
          scheduledDate: window.scheduledDate,
          scheduledStartTime: window.scheduledStartTime,
          scheduledEndTime: window.scheduledEndTime,
          status: "PENDING",
        },
      });
    } catch {
      // Unique constraint (recurringAppointmentId, occurrenceNumber) — outra
      // execução concorrente já gerou esta ocorrência. Idempotente, segue.
      continue;
    }
    const result = await materializeOccurrence(occ, series, true);
    if (result === "CONFIRMED") confirmed++;
    else conflicts++;
  }

  await prisma.recurringAppointment.update({
    where: { id: series.id },
    data: { generatedUntil: dates[dates.length - 1].date },
  });

  return { generated: dates.length, confirmed, conflicts };
}

// ---------------------------------------------------------------------------
// Operações por ocorrência (Regra 30/31/32) — a série continua ativa
// ---------------------------------------------------------------------------

async function loadSeriesWithOccurrence(occurrenceId: string, companyId: string) {
  const occurrence = await prisma.recurringAppointmentOccurrence.findFirst({
    where: { id: occurrenceId, recurringAppointment: { companyId } },
    include: { recurringAppointment: { include: { customer: true, barber: true, service: true } } },
  });
  if (!occurrence) return null;
  const { recurringAppointment: series, ...occ } = occurrence;
  return { occurrence: occ, series };
}

/** Cancela SÓ esta ocorrência — a série e as demais datas continuam intactas (Regra 30). */
export async function cancelOccurrenceCore(params: {
  occurrenceId: string;
  companyId: string;
  actorUserId: string | null;
  actorCustomerId: string | null;
}): Promise<ActionResult> {
  try {
    const loaded = await loadSeriesWithOccurrence(params.occurrenceId, params.companyId);
    if (!loaded) return actionError(new Error("Ocorrência não encontrada."));
    const { occurrence, series } = loaded;
    if (params.actorCustomerId && series.customerId !== params.actorCustomerId) {
      return actionError(new Error("Ocorrência não encontrada."));
    }
    if (occurrence.status === "CANCELLED" || occurrence.status === "SKIPPED") {
      return actionError(new Error("Esta ocorrência já não está mais ativa."));
    }

    if (occurrence.appointmentId) {
      await cancelAppointmentCore(occurrence.appointmentId, params.companyId, params.actorUserId);
    }
    if (occurrence.waitlistEntryId) {
      await cancelWaitlistEntryCore(occurrence.waitlistEntryId, params.companyId, params.actorCustomerId);
    }

    await prisma.recurringAppointmentOccurrence.update({ where: { id: occurrence.id }, data: { status: "CANCELLED" } });
    await logAudit({
      companyId: params.companyId,
      userId: params.actorUserId,
      action: "recurring_occurrence_cancelled",
      entityType: "recurring_appointment_occurrence",
      entityId: occurrence.id,
    });

    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

/** Altera SÓ esta ocorrência para uma nova data/horário — revalida do zero pelo mesmo motor (Regra 31). */
export async function editOccurrenceCore(params: {
  occurrenceId: string;
  companyId: string;
  newDate: Date;
  newStartTime: string;
  actorUserId: string | null;
  actorCustomerId: string | null;
}): Promise<ActionResult<{ status: MaterializeResult }>> {
  try {
    const loaded = await loadSeriesWithOccurrence(params.occurrenceId, params.companyId);
    if (!loaded) return actionError(new Error("Ocorrência não encontrada."));
    const { occurrence, series } = loaded;
    if (params.actorCustomerId && series.customerId !== params.actorCustomerId) {
      return actionError(new Error("Ocorrência não encontrada."));
    }
    if (occurrence.status === "CANCELLED" || occurrence.status === "SKIPPED") {
      return actionError(new Error("Esta ocorrência já não está mais ativa."));
    }

    if (occurrence.appointmentId) {
      await cancelAppointmentCore(occurrence.appointmentId, params.companyId, params.actorUserId);
    }
    if (occurrence.waitlistEntryId) {
      await cancelWaitlistEntryCore(occurrence.waitlistEntryId, params.companyId, params.actorCustomerId);
    }

    const window = occurrenceWindow(params.newDate, params.newStartTime, series.service.durationMinutes);
    const updated = await prisma.recurringAppointmentOccurrence.update({
      where: { id: occurrence.id },
      data: {
        scheduledDate: window.scheduledDate,
        scheduledStartTime: window.scheduledStartTime,
        scheduledEndTime: window.scheduledEndTime,
        status: "PENDING",
        appointmentId: null,
        waitlistEntryId: null,
        conflictReason: null,
      },
    });

    const result = await materializeOccurrence(updated, series, true);
    await logAudit({
      companyId: params.companyId,
      userId: params.actorUserId,
      action: "recurring_occurrence_edited",
      entityType: "recurring_appointment_occurrence",
      entityId: occurrence.id,
      metadata: { newDate: window.scheduledDate.toISOString().slice(0, 10), newStartTime: params.newStartTime, result },
    });

    return actionSuccess({ status: result });
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Altera o horário de "esta ocorrência em diante" (Regra 32 — as opções
 * "esta e as próximas" e "todas as futuras" são tratadas de forma
 * equivalente aqui: qualquer ocorrência ainda não confirmada no passado, a
 * partir da referência, entra na regra nova; o pedido não dá um exemplo que
 * distinga as duas de fato, e tratá-las igual evita ambiguidade sem perder
 * nenhuma capacidade pedida — documentado no relatório final). Ocorrências
 * PENDING/CONFLICT/WAITING_LIST viram SKIPPED (substituídas pela edição, não
 * apagadas — preserva o histórico); CONFIRMED são canceladas pelo fluxo
 * normal (libera a vaga, aciona lista de espera) e também viram SKIPPED.
 * Datas continuam as mesmas — só o horário do dia muda daqui pra frente.
 */
export async function editFutureOccurrencesCore(params: {
  recurringAppointmentId: string;
  companyId: string;
  fromOccurrenceId: string;
  newStartTime: string;
  actorUserId: string | null;
}): Promise<ActionResult<{ regenerated: number }>> {
  try {
    const series = await prisma.recurringAppointment.findFirst({
      where: { id: params.recurringAppointmentId, companyId: params.companyId },
      include: { customer: true, barber: true, service: true },
    });
    if (!series) return actionError(new Error("Recorrência não encontrada."));

    const reference = await prisma.recurringAppointmentOccurrence.findFirst({
      where: { id: params.fromOccurrenceId, recurringAppointmentId: series.id },
    });
    if (!reference) return actionError(new Error("Ocorrência de referência não encontrada."));

    const affected = await prisma.recurringAppointmentOccurrence.findMany({
      where: {
        recurringAppointmentId: series.id,
        occurrenceNumber: { gte: reference.occurrenceNumber },
        status: { in: ["PENDING", "CONFLICT", "WAITING_LIST", "CONFIRMED"] },
      },
      orderBy: { occurrenceNumber: "asc" },
    });

    const maxNumberRow = await prisma.recurringAppointmentOccurrence.aggregate({
      where: { recurringAppointmentId: series.id },
      _max: { occurrenceNumber: true },
    });
    let nextNumber = (maxNumberRow._max.occurrenceNumber ?? 0) + 1;

    let regenerated = 0;
    for (const occ of affected) {
      if (occ.appointmentId) await cancelAppointmentCore(occ.appointmentId, params.companyId, params.actorUserId);
      if (occ.waitlistEntryId) await cancelWaitlistEntryCore(occ.waitlistEntryId, params.companyId, null);
      await prisma.recurringAppointmentOccurrence.update({ where: { id: occ.id }, data: { status: "SKIPPED" } });

      const window = occurrenceWindow(occ.scheduledDate, params.newStartTime, series.service.durationMinutes);
      const replacement = await prisma.recurringAppointmentOccurrence.create({
        data: {
          recurringAppointmentId: series.id,
          occurrenceNumber: nextNumber++,
          scheduledDate: window.scheduledDate,
          scheduledStartTime: window.scheduledStartTime,
          scheduledEndTime: window.scheduledEndTime,
          status: "PENDING",
        },
      });
      await materializeOccurrence(replacement, series, true);
      regenerated++;
    }

    await prisma.recurringAppointment.update({ where: { id: series.id }, data: { startTime: params.newStartTime } });
    await logAudit({
      companyId: params.companyId,
      userId: params.actorUserId,
      action: "recurring_appointment_future_edited",
      entityType: "recurring_appointment",
      entityId: series.id,
      metadata: { newStartTime: params.newStartTime, fromOccurrenceNumber: reference.occurrenceNumber, regenerated },
    });

    return actionSuccess({ regenerated });
  } catch (error) {
    return actionError(error);
  }
}

// ---------------------------------------------------------------------------
// Pausar / retomar / cancelar a série (Regra 33/34/35)
// ---------------------------------------------------------------------------

export async function pauseRecurringAppointmentCore(params: {
  recurringAppointmentId: string;
  companyId: string;
  actorUserId: string | null;
}): Promise<ActionResult> {
  try {
    const result = await prisma.recurringAppointment.updateMany({
      where: { id: params.recurringAppointmentId, companyId: params.companyId, status: "ACTIVE" },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    if (result.count === 0) return actionError(new Error("Só é possível pausar uma recorrência ativa."));

    await logAudit({
      companyId: params.companyId,
      userId: params.actorUserId,
      action: "recurring_appointment_paused",
      entityType: "recurring_appointment",
      entityId: params.recurringAppointmentId,
    });
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

/** Retoma: recalcula disponibilidade e gera as próximas ocorrências respeitando bloqueios/HOLDs/agendamentos atuais (Regra 35). */
export async function resumeRecurringAppointmentCore(params: {
  recurringAppointmentId: string;
  companyId: string;
  actorUserId: string | null;
}): Promise<ActionResult> {
  try {
    const result = await prisma.recurringAppointment.updateMany({
      where: { id: params.recurringAppointmentId, companyId: params.companyId, status: "PAUSED" },
      data: { status: "ACTIVE", pausedAt: null },
    });
    if (result.count === 0) return actionError(new Error("Só é possível retomar uma recorrência pausada."));

    const series = await prisma.recurringAppointment.findFirst({
      where: { id: params.recurringAppointmentId },
      include: { customer: true, barber: true, service: true },
    });
    if (series && !series.occurrencesLimit && !series.endDate) {
      await generateProgressiveBatchForSeries(series);
    }

    await logAudit({
      companyId: params.companyId,
      userId: params.actorUserId,
      action: "recurring_appointment_resumed",
      entityType: "recurring_appointment",
      entityId: params.recurringAppointmentId,
    });
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Cancela a série (Regra 33) — nunca cancela agendamentos futuros
 * automaticamente sem essa escolha ser explícita (`alsoCancelFutureAppointments`).
 */
export async function cancelRecurringAppointmentCore(params: {
  recurringAppointmentId: string;
  companyId: string;
  actorUserId: string | null;
  actorCustomerId: string | null;
  alsoCancelFutureAppointments: boolean;
}): Promise<ActionResult<{ appointmentsCancelled: number }>> {
  try {
    const series = await prisma.recurringAppointment.findFirst({
      where: { id: params.recurringAppointmentId, companyId: params.companyId },
      include: { customer: true, occurrences: true },
    });
    if (!series) return actionError(new Error("Recorrência não encontrada."));
    if (params.actorCustomerId && series.customerId !== params.actorCustomerId) {
      return actionError(new Error("Recorrência não encontrada."));
    }
    if (series.status === "CANCELLED") return actionError(new Error("Esta recorrência já está cancelada."));

    const claimed = await prisma.recurringAppointment.updateMany({
      where: { id: series.id, status: { in: ["PENDING_APPROVAL", "ACTIVE", "PAUSED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (claimed.count === 0) return actionError(new Error("Esta recorrência não pode mais ser cancelada."));

    await prisma.recurringAppointmentOccurrence.updateMany({
      where: { recurringAppointmentId: series.id, status: { in: ["PENDING"] } },
      data: { status: "CANCELLED" },
    });

    const now = new Date();
    let appointmentsCancelled = 0;
    for (const occ of series.occurrences) {
      if (occ.status === "WAITING_LIST" && occ.waitlistEntryId) {
        await cancelWaitlistEntryCore(occ.waitlistEntryId, params.companyId, null);
        await prisma.recurringAppointmentOccurrence.update({ where: { id: occ.id }, data: { status: "CANCELLED" } });
      }
      if (params.alsoCancelFutureAppointments && occ.status === "CONFIRMED" && occ.appointmentId && occ.scheduledStartTime > now) {
        await cancelAppointmentCore(occ.appointmentId, params.companyId, params.actorUserId);
        await prisma.recurringAppointmentOccurrence.update({ where: { id: occ.id }, data: { status: "CANCELLED" } });
        appointmentsCancelled++;
      }
    }

    await logAudit({
      companyId: params.companyId,
      userId: params.actorUserId,
      action: "recurring_appointment_cancelled",
      entityType: "recurring_appointment",
      entityId: series.id,
      metadata: { alsoCancelFutureAppointments: params.alsoCancelFutureAppointments, appointmentsCancelled },
    });

    return actionSuccess({ appointmentsCancelled });
  } catch (error) {
    return actionError(error);
  }
}
