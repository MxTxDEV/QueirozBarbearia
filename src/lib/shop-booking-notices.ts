import { shopNow } from "@/lib/shop-time";
import "server-only";
import { prisma } from "@/lib/prisma";
import { describeFrequency } from "@/lib/recurring-helpers";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { sendAppointmentScheduledByShop, sendRecurringScheduledByShop } from "@/lib/whatsapp";

/**
 * Aviso em TEMPO REAL pro cliente quando a barbearia (barbeiro/recepção) marca o horário dele:
 * - horário avulso  → "acabamos de agendar um horário pra você";
 * - horário + recorrência de uma vez → uma só mensagem com as datas da recorrência.
 * Nunca derruba o agendamento: quem chama deve tratar erro como "só log" (o agendamento já existe).
 *
 * Depois de avisar, marca os lembretes automáticos que seriam redundantes: se o horário é daqui a
 * menos de 24h, o lembrete "de 1 dia antes" não precisa sair logo em seguida; se é hoje, o lembrete
 * das 7h também não.
 */

const MAX_DATES_IN_MESSAGE = 10;

async function stampRedundantReminders(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return;
  const now = shopNow();
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const stamp = new Date();
  await prisma.appointment.updateMany({
    where: { id: { in: appointmentIds }, reminder24hSentAt: null, startTime: { lte: in24h } },
    data: { reminder24hSentAt: stamp },
  });
  await prisma.appointment.updateMany({
    where: { id: { in: appointmentIds }, reminderMorningSentAt: null, appointmentDate: today },
    data: { reminderMorningSentAt: stamp },
  });
}

/** Cliente avulso (sem cadastro) não tem WhatsApp — não há a quem avisar. */
export async function notifyAppointmentScheduledByShop(appointmentId: string, companyId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
    include: { customer: true, barber: true, services: true, company: { select: { name: true } } },
  });
  if (!appt?.customer) return;
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") return;

  const result = await sendAppointmentScheduledByShop(companyId, appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    companyName: appt.company.name,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName),
    totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
  });
  if (result.ok) await stampRedundantReminders([appt.id]);
}

export async function notifyRecurringScheduledByShop(seriesId: string, companyId: string) {
  const series = await prisma.recurringAppointment.findFirst({
    where: { id: seriesId, companyId },
    include: {
      customer: true,
      barber: true,
      service: true,
      company: { select: { name: true } },
      occurrences: {
        where: { status: { in: ["CONFIRMED", "CONFLICT", "WAITING_LIST"] } },
        include: { appointment: { select: { id: true, status: true } } },
        orderBy: { scheduledStartTime: "asc" },
      },
    },
  });
  if (!series) return;

  const booked = series.occurrences.filter(
    (o) => o.status === "CONFIRMED" && o.appointment && (o.appointment.status === "PENDING" || o.appointment.status === "CONFIRMED")
  );
  if (booked.length === 0) return; // nada reservado: não há o que avisar

  const conflictCount = series.occurrences.filter((o) => o.status !== "CONFIRMED").length;
  const shown = booked.slice(0, MAX_DATES_IN_MESSAGE);

  const result = await sendRecurringScheduledByShop(companyId, series.customer.whatsapp, series.customer.id, {
    customerName: series.customer.fullName,
    companyName: series.company.name,
    serviceName: series.service.name,
    barberName: series.barber.name,
    frequencyLabel: describeFrequency(series.frequencyUnit, series.intervalValue),
    dates: shown.map((o) => o.scheduledStartTime),
    moreCount: booked.length - shown.length,
    conflictCount,
  });
  if (result.ok) await stampRedundantReminders(booked.flatMap((o) => (o.appointment ? [o.appointment.id] : [])));
}
