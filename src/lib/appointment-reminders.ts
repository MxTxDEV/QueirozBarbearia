import { shopNow } from "@/lib/shop-time";
import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { sendAppointmentReminder, sendMorningReminder } from "@/lib/whatsapp";
import type { Appointment, AppointmentService, AppointmentStatus, Barber, Customer } from "@prisma/client";

const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

type AppointmentWithRelations = Appointment & {
  customer: Customer;
  barber: Barber;
  services: AppointmentService[];
};

/** "amanhã" / "hoje" quando o dia do agendamento é esse (relógio da barbearia); senão, sem rótulo. */
function whenLabel(appointmentDate: Date) {
  const today = shopNow();
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const diffDays = Math.round((appointmentDate.getTime() - todayMs) / 86_400_000);
  return diffDays === 1 ? "amanhã" : diffDays === 0 ? "hoje" : undefined;
}

async function sendReminderAndStamp(appt: AppointmentWithRelations, kind: "24h" | "1h") {
  const result = await sendAppointmentReminder(appt.companyId, appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName),
    totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
    whenLabel: whenLabel(appt.appointmentDate),
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
 * Também dispara o lembrete das 7h do dia (ver sendDueMorningReminders).
 */
export async function sendDueAppointmentReminders() {
  const now = shopNow();
  const in1h = new Date(now.getTime() + 60 * 60_000);
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000);

  // Só entra na janela de 24h quem ainda tem mais de 1h pela frente — evita
  // mandar os dois lembretes quase colados pra quem marcou em cima da hora.
  const due24h = await prisma.appointment.findMany({
    where: {
      reminder24hSentAt: null,
      // Cliente avulso (sem cadastro) não tem WhatsApp — nunca recebe lembrete.
      customerId: { not: null },
      status: { in: ACTIVE_STATUSES },
      startTime: { gt: in1h, lte: in24h },
    },
    include: { customer: true, barber: true, services: true },
  });
  const due1h = await prisma.appointment.findMany({
    where: {
      reminder1hSentAt: null,
      customerId: { not: null },
      status: { in: ACTIVE_STATUSES },
      startTime: { gt: now, lte: in1h },
    },
    include: { customer: true, barber: true, services: true },
  });

  let sent24h = 0;
  let sent1h = 0;
  let failed = 0;

  for (const appt of due24h) {
    if (!appt.customer) continue;
    const ok = await sendReminderAndStamp({ ...appt, customer: appt.customer }, "24h");
    if (ok) sent24h++;
    else failed++;
  }
  for (const appt of due1h) {
    if (!appt.customer) continue;
    const ok = await sendReminderAndStamp({ ...appt, customer: appt.customer }, "1h");
    if (ok) sent1h++;
    else failed++;
  }

  const morning = await sendDueMorningReminders().catch((error) => {
    console.error("[cron] falha ao enviar lembretes das 7h:", error);
    return null;
  });

  return { checked24h: due24h.length, checked1h: due1h.length, sent24h, sent1h, failed, morning };
}

// ---------------------------------------------------------------------------
// Lembrete das 7h do dia ("é hoje")
// ---------------------------------------------------------------------------

/** A partir desta hora (relógio da barbearia) o lembrete do dia pode sair. */
export const MORNING_REMINDER_HOUR = 7;
/** Clientes por execução — o cron roda várias vezes, então a fila anda sozinha sem estourar o tempo da requisição. */
const MORNING_BATCH = 12;
/** Intervalo entre mensagens (evita rajada num número de WhatsApp comum, que costuma ser bloqueada). */
const MORNING_SPACING_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * No dia do horário, a partir das 7h, avisa cada cliente agendado naquele dia: "hoje você tem horário".
 * Uma mensagem por cliente, com todos os horários dele no dia. Só entra quem ainda tem mais de 1h
 * pela frente — antes disso o lembrete de 1h já cobre (e quem marcou/ajustou em cima da hora também).
 * Idempotente via reminderMorningSentAt: carimba mesmo se o envio falhar (igual aos outros lembretes),
 * pra uma falha do provedor não virar reenvio em loop a cada execução do cron.
 */
export async function sendDueMorningReminders(options: { limit?: number; spacingMs?: number } = {}) {
  const now = shopNow();
  if (now.getUTCHours() < MORNING_REMINDER_HOUR) return { skipped: "antes das 7h", customers: 0, sent: 0, failed: 0, remaining: 0 };

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in1h = new Date(now.getTime() + 60 * 60_000);

  const due = await prisma.appointment.findMany({
    where: {
      reminderMorningSentAt: null,
      // Cliente avulso (sem cadastro) não tem WhatsApp — nunca recebe lembrete.
      customerId: { not: null },
      status: { in: ACTIVE_STATUSES },
      appointmentDate: today,
      startTime: { gt: in1h },
      company: { status: "ACTIVE" },
    },
    include: { customer: true, barber: true, services: true, company: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });

  const byCustomer = new Map<string, typeof due>();
  for (const appt of due) {
    if (!appt.customerId) continue;
    byCustomer.set(appt.customerId, [...(byCustomer.get(appt.customerId) ?? []), appt]);
  }

  const customers = [...byCustomer.values()];
  const batch = customers.slice(0, options.limit ?? MORNING_BATCH);
  const spacingMs = options.spacingMs ?? MORNING_SPACING_MS;

  let sent = 0;
  let failed = 0;
  for (const appts of batch) {
    const customer = appts[0].customer;
    if (!customer) continue;
    const result = await sendMorningReminder(appts[0].companyId, customer.whatsapp, customer.id, {
      customerName: customer.fullName,
      companyName: appts[0].company.name,
      items: appts.map((a) => ({ time: formatTime(a.startTime), barberName: a.barber.name, services: a.services.map((s) => s.serviceName) })),
    }).catch(() => ({ ok: false as const }));

    await prisma.appointment.updateMany({
      where: { id: { in: appts.map((a) => a.id) }, reminderMorningSentAt: null },
      data: { reminderMorningSentAt: new Date() },
    });
    if (result.ok) sent++;
    else failed++;
    await sleep(spacingMs);
  }

  return { customers: customers.length, sent, failed, remaining: Math.max(0, customers.length - batch.length) };
}
