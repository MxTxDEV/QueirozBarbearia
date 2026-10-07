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
 * Não precisa "desmarcar" lembretes redundantes: os lembretes automáticos ignoram agendamentos
 * feitos já dentro da janela deles (ver appointment-reminders.ts).
 * Os textos e o liga/desliga vêm da configuração da barbearia (WhatsApp > Mensagens automáticas).
 */

const MAX_DATES_IN_MESSAGE = 10;

/** Cliente avulso (sem cadastro) não tem WhatsApp — não há a quem avisar. */
export async function notifyAppointmentScheduledByShop(appointmentId: string, companyId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
    include: { customer: true, barber: true, services: true, company: { select: { name: true } } },
  });
  if (!appt?.customer) return;
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") return;

  await sendAppointmentScheduledByShop(companyId, appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    companyName: appt.company.name,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName),
    totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
  });
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

  await sendRecurringScheduledByShop(companyId, series.customer.whatsapp, series.customer.id, {
    customerName: series.customer.fullName,
    companyName: series.company.name,
    serviceName: series.service.name,
    barberName: series.barber.name,
    frequencyLabel: describeFrequency(series.frequencyUnit, series.intervalValue),
    dates: shown.map((o) => o.scheduledStartTime),
    moreCount: booked.length - shown.length,
    conflictCount,
  });
}
