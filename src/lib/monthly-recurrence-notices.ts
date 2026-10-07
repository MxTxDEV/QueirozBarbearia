import { shopNow } from "@/lib/shop-time";
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeFrequency } from "@/lib/recurring-helpers";
import { sendMonthlyRecurrenceNotice } from "@/lib/whatsapp";
import { isNoticeWindow, monthBounds, monthKey, monthLabelPt, type NoticeSeries } from "@/lib/recurrence-notice";

const MAX_ATTEMPTS = 3;
/** Depois de uma tentativa (inclusive falha), espera isso antes de tentar o mesmo cliente de novo. */
const RETRY_COOLDOWN_MS = 30 * 60_000;
/** Quantos clientes por execução — o cron roda várias vezes ao dia, então a fila anda sozinha sem estourar o tempo da requisição. */
const DEFAULT_BATCH = 20;
/** Intervalo entre mensagens: enviar dezenas de mensagens coladas num número de WhatsApp comum é o que costuma gerar bloqueio. */
const DEFAULT_SPACING_MS = 2500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CustomerNotice = {
  companyId: string;
  companyName: string;
  customerId: string;
  customerName: string;
  whatsapp: string;
  series: Map<string, NoticeSeries>;
};

/**
 * Job (cron) — no 1º dia do mês, manda a CADA cliente com recorrência ativa uma
 * mensagem de WhatsApp com as datas da recorrência dele naquele mês (todas as empresas).
 *
 * - Só roda nos primeiros dias do mês, entre 9h e 19h (relógio da barbearia): o dia 1 é o
 *   alvo e os dias 2–3 cobrem uma falha do agendador. Fora disso não faz nada.
 * - Idempotente por cliente+mês (tabela monthly_recurrence_notices): dá pra acionar a cada
 *   poucos minutos, ou duas vezes ao mesmo tempo, que cada cliente recebe no máximo uma vez.
 * - Só entram datas que ainda vão acontecer, de agendamentos pendentes/confirmados.
 */
export async function sendMonthlyRecurrenceNotices(options: { limit?: number; spacingMs?: number; now?: Date; ignoreWindow?: boolean } = {}) {
  const now = options.now ?? shopNow();
  if (!options.ignoreWindow && !isNoticeWindow(now)) {
    return { skipped: "fora da janela (dias 1–3 do mês, das 9h às 19h)", month: monthKey(now), eligible: 0, sent: 0, failed: 0, remaining: 0 };
  }

  const month = monthKey(now);
  const { end } = monthBounds(now);

  const occurrences = await prisma.recurringAppointmentOccurrence.findMany({
    where: {
      status: "CONFIRMED",
      scheduledStartTime: { gte: now, lt: end },
      appointment: { status: { in: ["PENDING", "CONFIRMED"] } },
      recurringAppointment: { status: "ACTIVE", company: { status: "ACTIVE" } },
    },
    include: {
      recurringAppointment: {
        include: { customer: true, barber: true, service: true, company: { select: { name: true } } },
      },
    },
    orderBy: { scheduledStartTime: "asc" },
  });

  const byCustomer = new Map<string, CustomerNotice>();
  for (const occ of occurrences) {
    const series = occ.recurringAppointment;
    const customer = series.customer;
    let entry = byCustomer.get(customer.id);
    if (!entry) {
      entry = {
        companyId: series.companyId,
        companyName: series.company.name,
        customerId: customer.id,
        customerName: customer.fullName,
        whatsapp: customer.whatsapp,
        series: new Map(),
      };
      byCustomer.set(customer.id, entry);
    }
    let group = entry.series.get(series.id);
    if (!group) {
      group = {
        serviceName: series.service.name,
        barberName: series.barber.name,
        frequencyLabel: describeFrequency(series.frequencyUnit, series.intervalValue),
        dates: [],
      };
      entry.series.set(series.id, group);
    }
    group.dates.push(occ.scheduledStartTime);
  }

  const existing = await prisma.monthlyRecurrenceNotice.findMany({
    where: { month, customerId: { in: [...byCustomer.keys()] } },
  });
  const existingByCustomer = new Map(existing.map((row) => [row.customerId, row]));
  const cooldownLimit = new Date(Date.now() - RETRY_COOLDOWN_MS);

  // Quem ainda precisa receber: sem registro, ou com tentativa anterior que falhou, já fora do tempo de espera.
  const pending = [...byCustomer.values()].filter((entry) => {
    const row = existingByCustomer.get(entry.customerId);
    if (!row) return true;
    return !row.sentAt && row.attempts < MAX_ATTEMPTS && row.lockedAt < cooldownLimit;
  });

  const limit = options.limit ?? DEFAULT_BATCH;
  const spacingMs = options.spacingMs ?? DEFAULT_SPACING_MS;
  const batch = pending.slice(0, limit);
  const monthLabel = monthLabelPt(now);

  let sent = 0;
  let failed = 0;
  for (const entry of batch) {
    const claimed = await claimNotice(entry, month, cooldownLimit);
    if (!claimed) continue; // outro disparo do cron pegou este cliente

    const result = await sendMonthlyRecurrenceNotice(entry.companyId, entry.whatsapp, entry.customerId, {
      customerName: entry.customerName,
      companyName: entry.companyName,
      monthLabel,
      series: [...entry.series.values()],
    }).catch((error: unknown) => ({ ok: false as const, errorMessage: error instanceof Error ? error.message : String(error) }));

    if (result.ok) {
      await prisma.monthlyRecurrenceNotice.update({ where: { id: claimed }, data: { sentAt: new Date() } });
      sent++;
    } else {
      failed++;
    }
    await sleep(spacingMs + Math.floor(Math.random() * 1000));
  }

  return { month, eligible: byCustomer.size, pendingBefore: pending.length, sent, failed, remaining: Math.max(0, pending.length - batch.length) };
}

/** Reivindica o envio (cria ou "reabre" o registro). Devolve o id, ou null se outro disparo já pegou. */
async function claimNotice(entry: CustomerNotice, month: string, cooldownLimit: Date): Promise<string | null> {
  try {
    const row = await prisma.monthlyRecurrenceNotice.create({
      data: { companyId: entry.companyId, customerId: entry.customerId, month, attempts: 1 },
    });
    return row.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }
  // Já existe: só reabre se for uma tentativa antiga que falhou (condição checada na própria atualização, atomicamente).
  const reopened = await prisma.monthlyRecurrenceNotice.updateMany({
    where: { customerId: entry.customerId, month, sentAt: null, attempts: { lt: MAX_ATTEMPTS }, lockedAt: { lt: cooldownLimit } },
    data: { attempts: { increment: 1 }, lockedAt: new Date() },
  });
  if (reopened.count === 0) return null;
  const row = await prisma.monthlyRecurrenceNotice.findUnique({ where: { customerId_month: { customerId: entry.customerId, month } } });
  return row?.id ?? null;
}
