import { shopNow } from "@/lib/shop-time";
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeFrequency } from "@/lib/recurring-helpers";
import { sendWithRule } from "@/lib/whatsapp";
import { ensureAutomations, getCustomerSegments } from "@/lib/whatsapp/automations";
import { hhmmToMinutes, pickRule } from "@/lib/whatsapp/automation-defs";
import { monthlyVars } from "@/lib/recurrence-notice";
import { monthBounds, monthKey, monthLabelPt, type NoticeSeries, type NoticeSingle } from "@/lib/recurrence-notice";
import type { WhatsappAutomation } from "@prisma/client";

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
  singles: NoticeSingle[];
};

/**
 * Job (cron) — no 1º dia do mês, manda a CADA cliente que tem horário marcado no mês uma
 * mensagem de WhatsApp com todas as datas e horários dele (as da recorrência agrupadas e, à
 * parte, os avulsos), em todas as empresas.
 *
 * - Só roda nos primeiros dias do mês, entre 9h e 19h (relógio da barbearia): o dia 1 é o
 *   alvo e os dias 2–3 cobrem uma falha do agendador. Fora disso não faz nada.
 * - Idempotente por cliente+mês (tabela monthly_recurrence_notices): dá pra acionar a cada
 *   poucos minutos, ou duas vezes ao mesmo tempo, que cada cliente recebe no máximo uma vez.
 * - Só entram horários que ainda vão acontecer, de agendamentos pendentes/confirmados.
 */
export async function sendMonthlyRecurrenceNotices(options: { limit?: number; spacingMs?: number; now?: Date; ignoreWindow?: boolean } = {}) {
  const now = options.now ?? shopNow();
  const month = monthKey(now);
  const { end } = monthBounds(now);

  const companies = await prisma.company.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  for (const company of companies) await ensureAutomations(company.id);
  const rules = await prisma.whatsappAutomation.findMany({
    where: { kind: "MONTHLY_SUMMARY", enabled: true, companyId: { in: companies.map((c) => c.id) } },
  });

  // Regra "aberta" agora: estamos no dia configurado (ou nos 2 seguintes, pra cobrir uma falha do agendador),
  // a partir da hora configurada e até a noite — nada de mensagem de madrugada.
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const isOpen = (rule: WhatsappAutomation) => {
    const day = rule.dayOfMonth ?? 1;
    const from = hhmmToMinutes(rule.sendTime ?? "09:00");
    const until = Math.min(23 * 60 + 59, Math.max(19 * 60, from + 600));
    return now.getUTCDate() >= day && now.getUTCDate() <= day + 2 && nowMinutes >= from && nowMinutes < until;
  };
  const open = options.ignoreWindow ? rules : rules.filter(isOpen);
  if (open.length === 0) {
    return { skipped: "nenhuma regra de resumo mensal aberta agora", month, eligible: 0, sent: 0, failed: 0, remaining: 0 };
  }
  const openCompanyIds = [...new Set(open.map((rule) => rule.companyId))];

  // Tudo que cada cliente tem marcado de agora até o fim do mês (recorrência ou avulso), de qualquer empresa ativa.
  const appointments = await prisma.appointment.findMany({
    where: {
      customerId: { not: null },
      status: { in: ["PENDING", "CONFIRMED"] },
      startTime: { gte: now, lt: end },
      companyId: { in: openCompanyIds },
    },
    include: {
      customer: true,
      barber: true,
      services: true,
      company: { select: { name: true } },
      recurringOccurrence: {
        include: { recurringAppointment: { include: { service: true, barber: true } } },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const byCustomer = new Map<string, CustomerNotice>();
  for (const appt of appointments) {
    const customer = appt.customer;
    if (!customer) continue;
    let entry = byCustomer.get(customer.id);
    if (!entry) {
      entry = {
        companyId: appt.companyId,
        companyName: appt.company.name,
        customerId: customer.id,
        customerName: customer.fullName,
        whatsapp: customer.whatsapp,
        series: new Map(),
        singles: [],
      };
      byCustomer.set(customer.id, entry);
    }

    const series = appt.recurringOccurrence?.recurringAppointment;
    if (series && series.status === "ACTIVE") {
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
      group.dates.push(appt.startTime);
    } else {
      entry.singles.push({ start: appt.startTime, serviceName: appt.services.map((x) => x.serviceName).join(" + "), barberName: appt.barber.name });
    }
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
  const monthLabel = monthLabelPt(now);

  let sent = 0;
  let failed = 0;
  let processed = 0;
  for (const entry of pending) {
    // Qual texto vale para este cliente (por tipo de cliente), entre as regras abertas da barbearia dele.
    const companyRules = open.filter((rule) => rule.companyId === entry.companyId);
    const segments = companyRules.some((rule) => rule.audience !== "ALL")
      ? await getCustomerSegments(entry.companyId, entry.customerId)
      : { recurring: false, hasCompleted: false };
    const rule = pickRule(companyRules, segments);
    if (!rule) continue;
    if (processed >= limit) break;

    const claimed = await claimNotice(entry, month, cooldownLimit);
    if (!claimed) continue; // outro disparo do cron pegou este cliente
    processed++;

    const result = await sendWithRule({
      companyId: entry.companyId,
      rule,
      phone: entry.whatsapp,
      customerId: entry.customerId,
      vars: monthlyVars({
        customerName: entry.customerName,
        companyName: entry.companyName,
        monthLabel,
        series: [...entry.series.values()],
        singles: entry.singles,
      }),
    }).catch((error: unknown) => ({ ok: false as const, errorMessage: error instanceof Error ? error.message : String(error) }));

    if (result.ok) {
      await prisma.monthlyRecurrenceNotice.update({ where: { id: claimed }, data: { sentAt: new Date() } });
      sent++;
    } else {
      failed++;
    }
    await sleep(spacingMs + Math.floor(Math.random() * 1000));
  }

  return { month, eligible: byCustomer.size, pendingBefore: pending.length, sent, failed, remaining: Math.max(0, pending.length - processed) };
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
