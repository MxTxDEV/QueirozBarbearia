import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { sendAppointmentReminder } from "@/lib/whatsapp";
import type { Appointment, AppointmentService, AppointmentStatus, Barber, Customer } from "@prisma/client";

const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

type AppointmentWithRelations = Appointment & {
  customer: Customer;
  barber: Barber;
  services: AppointmentService[];
};

async function sendReminderAndStamp(appt: AppointmentWithRelations, kind: "24h" | "1h") {
  const result = await sendAppointmentReminder(appt.companyId, appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName),
    totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
  });

  // Carimba mesmo se o envio falhar — uma falha temporária do provedor não
  // pode virar reenvio em loop a cada execução do cron (ver comentário no
  // schema sobre a idempotência desses dois campos).
  if (kind === "24h") {
    await prisma.appointment.updateMany({
      where: { id: appt.id, reminder24hSentAt: null },
      data: { reminder24hSentAt: new Date() },
    });
  } else {
    await prisma.appointment.updateMany({
      where: { id: appt.id, reminder1hSentAt: null },
      data: { reminder1hSentAt: new Date() },
    });
  }

  return result.ok;
}

/**
 * Job (cron) — varre agendamentos de todas as empresas e envia lembretes de
 * 24h e 1h antes do horário marcado. Idempotente via
 * reminder24hSentAt/reminder1hSentAt: o cron pode rodar quantas vezes quiser
 * (reinício da aplicação incluído) que cada agendamento recebe cada
 * lembrete no máximo uma vez. Cancelados saem sozinhos da busca (o status
 * deixa de ser PENDING/CONFIRMED); remarcar é sempre cancelar + criar um
 * agendamento novo, que nasce com os dois campos nulos — o horário antigo
 * nunca mais aparece nesta busca, e o novo ganha lembretes normalmente.
 */
export async function sendDueAppointmentReminders() {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60 * 60_000);
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000);

  // Só entra na janela de 24h quem ainda tem mais de 1h pela frente — evita
  // mandar os dois lembretes quase colados pra quem marcou em cima da hora.
  const due24h = await prisma.appointment.findMany({
    where: {
      reminder24hSentAt: null,
      status: { in: ACTIVE_STATUSES },
      startTime: { gt: in1h, lte: in24h },
    },
    include: { customer: true, barber: true, services: true },
  });
  const due1h = await prisma.appointment.findMany({
    where: {
      reminder1hSentAt: null,
      status: { in: ACTIVE_STATUSES },
      startTime: { gt: now, lte: in1h },
    },
    include: { customer: true, barber: true, services: true },
  });

  let sent24h = 0;
  let sent1h = 0;
  let failed = 0;

  for (const appt of due24h) {
    const ok = await sendReminderAndStamp(appt, "24h");
    if (ok) sent24h++;
    else failed++;
  }
  for (const appt of due1h) {
    const ok = await sendReminderAndStamp(appt, "1h");
    if (ok) sent1h++;
    else failed++;
  }

  return { checked24h: due24h.length, checked1h: due1h.length, sent24h, sent1h, failed };
}
