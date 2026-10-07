import { shopNow } from "@/lib/shop-time";
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { sendWithRule } from "@/lib/whatsapp";
import { confirmationUrlFor } from "@/lib/confirmation-link";
import { ensureAutomations, getCustomerSegments } from "@/lib/whatsapp/automations";
import { hhmmToMinutes, pickRule, whenLabel } from "@/lib/whatsapp/automation-defs";
import { appointmentVars, morningVars } from "@/lib/whatsapp/templates";
import type { AppointmentStatus, WhatsappAutomation } from "@prisma/client";

const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];
const DAY_MS = 86_400_000;

/** Mensagens por execução e intervalo entre elas — evita rajada num número de WhatsApp comum (que costuma ser bloqueado). */
const BEFORE_BATCH = 25;
const MORNING_BATCH = 12;
const SPACING_MS = 2000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Garante as regras padrão de todas as empresas ativas (uma vez por processo) e devolve os ids. */
async function activeCompanyIds() {
  const companies = await prisma.company.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  for (const company of companies) await ensureAutomations(company.id);
  return companies.map((c) => c.id);
}

/**
 * Job (cron) — manda os lembretes automáticos de todas as empresas, conforme as regras que cada
 * barbearia configurou em WhatsApp > Mensagens automáticas:
 *   • "X antes do horário" (quantas regras quiser: 1 dia, 2 horas, 1 hora…);
 *   • "manhã do dia" (a partir da hora definida).
 * Idempotente: cada regra manda no máximo uma vez por agendamento e horário (tabela
 * whatsapp_automation_logs; remarcar volta a valer pro novo horário). Pode ser acionado a cada
 * poucos minutos. Cancelados saem sozinhos (só PENDING/CONFIRMED).
 */
export async function sendDueAppointmentReminders() {
  const companyIds = await activeCompanyIds();
  const before = await sendDueBeforeReminders(companyIds).catch((error) => {
    console.error("[cron] falha nos lembretes antes do horário:", error);
    return null;
  });
  const morning = await sendDueMorningReminders({ companyIds }).catch((error) => {
    console.error("[cron] falha nos lembretes da manhã:", error);
    return null;
  });
  return { before, morning };
}

// ---------------------------------------------------------------------------
// "X antes do horário"
// ---------------------------------------------------------------------------

/** Chaves das regras padrão antigas → o carimbo que o sistema usava antes (pra não mandar de novo logo após atualizar). */
const LEGACY_STAMP: Record<string, "reminder24hSentAt" | "reminder1hSentAt"> = {
  "REMINDER_BEFORE:1d": "reminder24hSentAt",
  "REMINDER_BEFORE:1h": "reminder1hSentAt",
};

export async function sendDueBeforeReminders(companyIds: string[], options: { limit?: number; spacingMs?: number } = {}) {
  const now = shopNow();
  const limit = options.limit ?? BEFORE_BATCH;
  const spacingMs = options.spacingMs ?? SPACING_MS;

  const rules = await prisma.whatsappAutomation.findMany({
    where: { kind: "REMINDER_BEFORE", enabled: true, companyId: { in: companyIds }, offsetMinutes: { not: null } },
  });
  if (rules.length === 0) return { checked: 0, sent: 0, failed: 0, remaining: 0 };

  // Regras do mesmo tamanho (ex: duas de "1 dia antes", uma pra cada tipo de cliente) disputam o mesmo horário.
  const groups = new Map<string, WhatsappAutomation[]>();
  for (const rule of rules) {
    const key = `${rule.companyId}|${rule.offsetMinutes}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }

  let checked = 0;
  let sent = 0;
  let failed = 0;
  let remaining = 0;

  for (const group of groups.values()) {
    const offset = group[0].offsetMinutes as number;
    const companyId = group[0].companyId;
    // Janela: do momento em que a regra "abre" (X antes) até metade do caminho — passou disso, o lembrete já ficou velho.
    const due = await prisma.appointment.findMany({
      where: {
        companyId,
        customerId: { not: null },
        status: { in: ACTIVE_STATUSES },
        startTime: { gte: new Date(now.getTime() + (offset * 60_000) / 2), lte: new Date(now.getTime() + offset * 60_000) },
      },
      include: {
        customer: true,
        barber: true,
        services: true,
        company: { select: { name: true } },
        automationLogs: { where: { automationId: { in: group.map((r) => r.id) } } },
      },
      orderBy: { startTime: "asc" },
    });

    for (const appt of due) {
      if (!appt.customer) continue;
      // Marcado já dentro da janela (ex: agendou 3h antes e a regra é "1 dia antes"): o cliente acabou de saber — não repete.
      if (shopNow(appt.createdAt).getTime() > appt.startTime.getTime() - offset * 60_000) continue;
      checked++;

      const segments = group.some((r) => r.audience !== "ALL")
        ? await getCustomerSegments(companyId, appt.customer.id)
        : { recurring: false, hasCompleted: false };
      const rule = pickRule(group, segments);
      if (!rule) continue;

      const legacy = LEGACY_STAMP[rule.key];
      if (legacy && appt[legacy]) continue;
      if (appt.automationLogs.some((log) => log.automationId === rule.id && log.startTime.getTime() === appt.startTime.getTime())) continue;

      if (sent + failed >= limit) {
        remaining++;
        continue;
      }

      // Reivindica ANTES de enviar (único por agendamento+regra+horário): dois disparos do cron não duplicam.
      try {
        await prisma.whatsappAutomationLog.create({ data: { appointmentId: appt.id, automationId: rule.id, startTime: appt.startTime } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }

      const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const diffDays = Math.round((appt.appointmentDate.getTime() - todayMs) / DAY_MS);
      const result = await sendWithRule({
        companyId,
        rule,
        phone: appt.customer.whatsapp,
        customerId: appt.customer.id,
        vars: appointmentVars({
          customerName: appt.customer.fullName,
          companyName: appt.company.name,
          date: formatDate(appt.appointmentDate),
          time: formatTime(appt.startTime),
          barberName: appt.barber.name,
          services: appt.services.map((s) => s.serviceName),
          totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
          when: whenLabel(diffDays, formatDate(appt.appointmentDate)),
          confirmUrl: await confirmationUrlFor(appt.id),
        }),
      }).catch(() => ({ ok: false as const }));
      // Registrado mesmo se o envio falhar — uma falha temporária do provedor não pode virar reenvio em loop.
      if (result.ok) sent++;
      else failed++;
      await sleep(spacingMs);
    }
  }

  return { checked, sent, failed, remaining };
}

// ---------------------------------------------------------------------------
// Lembrete "é hoje" (manhã do dia)
// ---------------------------------------------------------------------------

/**
 * No dia do horário, a partir da hora configurada (padrão 7h), avisa cada cliente agendado naquele
 * dia. Uma mensagem por cliente, com todos os horários dele no dia. Só entra quem ainda tem mais de
 * 30 min pela frente. Idempotente via reminderMorningSentAt (carimba mesmo se o envio falhar).
 */
export async function sendDueMorningReminders(options: { companyIds?: string[]; limit?: number; spacingMs?: number } = {}) {
  const now = shopNow();
  const companyIds = options.companyIds ?? (await activeCompanyIds());
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const rules = await prisma.whatsappAutomation.findMany({
    where: { kind: "REMINDER_MORNING", enabled: true, companyId: { in: companyIds }, sendTime: { not: null } },
  });
  // Só importa a regra que já "abriu" hoje (hora configurada já chegou).
  const open = rules.filter((rule) => hhmmToMinutes(rule.sendTime as string) <= nowMinutes);
  if (open.length === 0) return { customers: 0, sent: 0, failed: 0, remaining: 0 };

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = await prisma.appointment.findMany({
    where: {
      reminderMorningSentAt: null,
      // Cliente avulso (sem cadastro) não tem WhatsApp — nunca recebe lembrete.
      customerId: { not: null },
      status: { in: ACTIVE_STATUSES },
      appointmentDate: today,
      startTime: { gt: new Date(now.getTime() + 30 * 60_000) },
      companyId: { in: [...new Set(open.map((r) => r.companyId))] },
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
  const limit = options.limit ?? MORNING_BATCH;
  const spacingMs = options.spacingMs ?? SPACING_MS;

  let sent = 0;
  let failed = 0;
  let remaining = 0;
  for (const appts of customers) {
    const customer = appts[0].customer;
    if (!customer) continue;
    const companyRules = open.filter((r) => r.companyId === appts[0].companyId);
    const segments = companyRules.some((r) => r.audience !== "ALL")
      ? await getCustomerSegments(appts[0].companyId, customer.id)
      : { recurring: false, hasCompleted: false };
    const rule = pickRule(companyRules, segments);
    if (!rule) continue;

    // Marcado hoje depois da hora do lembrete: o cliente acabou de saber — não repete.
    const opensAt = today.getTime() + hhmmToMinutes(rule.sendTime as string) * 60_000;
    const fresh = appts.filter((a) => shopNow(a.createdAt).getTime() < opensAt);
    if (fresh.length === 0) continue;

    if (sent + failed >= limit) {
      remaining++;
      continue;
    }

    const result = await sendWithRule({
      companyId: appts[0].companyId,
      rule,
      phone: customer.whatsapp,
      customerId: customer.id,
      vars: morningVars({
        customerName: customer.fullName,
        companyName: appts[0].company.name,
        items: fresh.map((a) => ({ time: formatTime(a.startTime), barberName: a.barber.name, services: a.services.map((s) => s.serviceName) })),
      }),
    }).catch(() => ({ ok: false as const }));

    await prisma.appointment.updateMany({
      where: { id: { in: fresh.map((a) => a.id) }, reminderMorningSentAt: null },
      data: { reminderMorningSentAt: new Date() },
    });
    if (result.ok) sent++;
    else failed++;
    await sleep(spacingMs);
  }

  return { customers: customers.length, sent, failed, remaining };
}
