import "server-only";
import { prisma } from "@/lib/prisma";
import { MockWhatsAppProvider } from "./mock-provider";
import { CloudApiWhatsAppProvider } from "./cloud-api-provider";
import { EvolutionApiWhatsAppProvider } from "./evolution-provider";
import { getEvolutionConfig, getEvolutionConnectionState, getEvolutionConnectedNumber } from "./evolution-client";
import type { WhatsAppProvider, AppointmentMessageData, WhatsappSendResult } from "./types";
import { renderTemplate, pickRule, type AutomationKind } from "./automation-defs";
import { automationsOfKind, companyDisplayName, getCustomerSegments, templateOf } from "./automations";
import { bookingLinkVar, withBookingFooter } from "./message-settings";
import {
  appointmentVars,
  cancellationVars,
  thanksVars,
  waitlistVars,
  recurringApprovedVars,
  recurringRejectedVars,
  recurringBookedVars,
  morningVars,
  appointmentConfirmationTemplate,
  appointmentCancellationTemplate,
  appointmentReminderTemplate,
  newAppointmentInternalTemplate,
  otpTemplate,
  serviceThanksTemplate,
  waitlistSlotOfferedTemplate,
  recurringRequestInternalTemplate,
  type Vars,
} from "./templates";
import { monthlyVars, type MonthlyMessageData } from "@/lib/recurrence-notice";

export {
  appointmentCancellationTemplate,
  appointmentConfirmationTemplate,
  appointmentReminderTemplate,
  newAppointmentInternalTemplate,
  serviceThanksTemplate,
  waitlistSlotOfferedTemplate,
};
export type { AppointmentMessageData };

/** cloud_api e mock não variam por empresa — um único provedor compartilhado serve. */
let cachedSharedProvider: WhatsAppProvider | null = null;
/** evolution varia por empresa (cada uma tem sua própria instância/número). */
const cachedEvolutionProviders = new Map<string, WhatsAppProvider>();

/** Fábrica do provedor de WhatsApp, controlada por variáveis de ambiente. */
function getProvider(companyId: string): WhatsAppProvider {
  const kind = process.env.WHATSAPP_PROVIDER ?? "mock";

  if (kind === "cloud_api") {
    if (cachedSharedProvider) return cachedSharedProvider;
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (apiUrl && apiKey && phoneNumberId) {
      cachedSharedProvider = new CloudApiWhatsAppProvider(apiUrl, apiKey, phoneNumberId);
      return cachedSharedProvider;
    }
  }

  if (kind === "evolution") {
    const cached = cachedEvolutionProviders.get(companyId);
    if (cached) return cached;
    const config = getEvolutionConfig(companyId);
    if (config) {
      const provider = new EvolutionApiWhatsAppProvider(config.apiUrl, config.apiKey, config.instanceName);
      cachedEvolutionProviders.set(companyId, provider);
      return provider;
    }
  }

  if (!cachedSharedProvider) {
    if (process.env.NODE_ENV === "production") {
      // Alto-falante no log do servidor: cair pro mock em produção significa
      // que nenhuma mensagem real (nem código de login) chega ao cliente —
      // precisa ser corrigido configurando WHATSAPP_PROVIDER corretamente.
      console.error(
        `[WhatsApp] ATENÇÃO: WHATSAPP_PROVIDER="${kind}" está ausente ou mal configurado em produção — caindo para o modo MOCK. Mensagens reais (incluindo códigos de login de clientes) não serão entregues.`
      );
    }
    cachedSharedProvider = new MockWhatsAppProvider();
  }
  return cachedSharedProvider;
}

export type WhatsappStatus = {
  /** Provedor selecionado via WHATSAPP_PROVIDER, mesmo que ainda mal configurado. */
  configuredKind: "mock" | "cloud_api" | "evolution";
  /** Provedor efetivamente em uso (cai para "mock" se a configuração estiver incompleta). */
  mode: "mock" | "cloud_api" | "evolution";
  connected: boolean;
  /** Número de WhatsApp realmente conectado à instância (só quando `connected` é true). */
  connectedNumber?: string;
};

export async function whatsappConnectionStatus(companyId: string): Promise<WhatsappStatus> {
  const configuredKind = (process.env.WHATSAPP_PROVIDER as WhatsappStatus["configuredKind"] | undefined) ?? "mock";

  if (configuredKind === "cloud_api") {
    const configured = !!process.env.WHATSAPP_API_URL && !!process.env.WHATSAPP_API_KEY && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    return { configuredKind, mode: configured ? "cloud_api" : "mock", connected: configured };
  }

  if (configuredKind === "evolution") {
    const config = getEvolutionConfig(companyId);
    if (!config) return { configuredKind, mode: "mock", connected: false };
    const state = await getEvolutionConnectionState(config);
    const connected = state === "open";
    const connectedNumber = connected ? await getEvolutionConnectedNumber(config) : null;
    return { configuredKind, mode: "evolution", connected, connectedNumber: connectedNumber ?? undefined };
  }

  return { configuredKind: "mock", mode: "mock", connected: false };
}

/**
 * Envia uma mensagem de WhatsApp e persiste o registro em `whatsapp_messages`,
 * independentemente do provedor configurado. Todo envio (sucesso ou falha)
 * fica registrado para auditoria na tela de configurações.
 */
export async function sendWhatsapp(params: {
  companyId: string;
  phone: string;
  message: string;
  customerId?: string;
  /**
   * Texto alternativo persistido em `whatsapp_messages` no lugar de `message`.
   * Usado para não guardar segredos (ex: código OTP) em texto puro num log
   * que ADMIN e BARBER da empresa podem ler em /admin/whatsapp — a mensagem
   * real (com `message`) ainda é enviada normalmente ao cliente.
   */
  logMessage?: string;
}) {
  const provider = getProvider(params.companyId);
  const result = await provider.sendMessage(params.phone, params.message);

  await prisma.whatsappMessage.create({
    data: {
      companyId: params.companyId,
      customerId: params.customerId,
      phone: params.phone,
      message: params.logMessage ?? params.message,
      direction: "OUTBOUND",
      status: result.ok ? "SENT" : "FAILED",
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    },
  });

  return result;
}

/**
 * Número da barbearia para alertas internos. Prioriza a configuração
 * própria da empresa (SystemSetting "shop_whatsapp"); em seguida o número
 * realmente conectado na instância do Evolution API (o que foi pareado
 * escaneando o QR code em /admin/whatsapp) — nunca um valor fixo no
 * código; por fim BARBERSHOP_WHATSAPP_NUMBER como último fallback global.
 */
async function barbershopNumber(companyId: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { companyId_key: { companyId, key: "shop_whatsapp" } },
  });
  if (setting?.value) return setting.value;

  const configuredKind = process.env.WHATSAPP_PROVIDER ?? "mock";
  if (configuredKind === "evolution") {
    const config = getEvolutionConfig(companyId);
    if (config) {
      const connectedNumber = await getEvolutionConnectedNumber(config);
      if (connectedNumber) return connectedNumber;
    }
  }

  return process.env.BARBERSHOP_WHATSAPP_NUMBER ?? null;
}

/** Resultado de um envio automático: `skipped` = a regra está desligada ou não vale para este tipo de cliente. */
export type AutomatedSendResult = WhatsappSendResult & { skipped?: boolean };

/**
 * Envia uma mensagem automática respeitando a configuração da empresa (tela WhatsApp > Mensagens
 * automáticas): escolhe a regra ligada que vale para o tipo deste cliente, usa o texto editado (ou o
 * padrão) e preenche os campos. Sem regra aplicável, não envia nada (`skipped`).
 */
export async function sendAutomated(params: {
  companyId: string;
  kind: AutomationKind;
  phone: string;
  customerId: string;
  vars: Vars;
}): Promise<AutomatedSendResult> {
  const rules = await automationsOfKind(params.companyId, params.kind);
  const needsSegments = rules.some((rule) => rule.audience !== "ALL");
  const segments = needsSegments
    ? await getCustomerSegments(params.companyId, params.customerId)
    : { recurring: false, hasCompleted: false };
  const rule = pickRule(rules, segments);
  if (!rule) return { ok: true, skipped: true };
  return sendWithRule({ ...params, rule });
}

/** Envia usando uma regra JÁ escolhida (os lembretes agendados escolhem a regra por conta própria). */
export async function sendWithRule(params: {
  companyId: string;
  rule: Parameters<typeof templateOf>[0];
  phone: string;
  customerId: string;
  vars: Vars;
}): Promise<WhatsappSendResult> {
  const companyName = params.vars.barbearia ?? (await companyDisplayName(params.companyId));
  const template = templateOf(params.rule);
  const filled = renderTemplate(template, {
    ...params.vars,
    barbearia: companyName,
    link_agendamento: await bookingLinkVar(params.companyId),
  });
  // Link de divulgação ao fim de toda mensagem automática (a menos que a barbearia desligue o rodapé).
  const message = await withBookingFooter(params.companyId, filled, template);
  return sendWhatsapp({ companyId: params.companyId, phone: params.phone, customerId: params.customerId, message });
}

export async function sendAppointmentConfirmation(companyId: string, phone: string, customerId: string, data: AppointmentMessageData) {
  return sendAutomated({ companyId, kind: "CONFIRMATION", phone, customerId, vars: appointmentVars(data) });
}

export async function sendServiceThanks(
  companyId: string,
  phone: string,
  customerId: string,
  data: { customerName: string; companyName: string; reviewUrl?: string }
) {
  return sendAutomated({ companyId, kind: "THANKS", phone, customerId, vars: thanksVars(data) });
}

export async function sendAppointmentCancellation(
  companyId: string,
  phone: string,
  customerId: string,
  data: Pick<AppointmentMessageData, "customerName" | "date" | "time">
) {
  return sendAutomated({ companyId, kind: "CANCELLATION", phone, customerId, vars: cancellationVars(data) });
}

/** Avisa o cliente que uma vaga da lista de espera ficou disponível (HOLD ativo, com prazo pra confirmar). */
export async function sendWaitlistSlotOffer(
  companyId: string,
  phone: string,
  customerId: string,
  data: { customerName: string; serviceName: string; barberName: string; date: string; time: string; confirmByTime: string }
) {
  return sendAutomated({ companyId, kind: "WAITLIST_OFFER", phone, customerId, vars: waitlistVars(data) });
}

export async function sendRecurringApproved(
  companyId: string,
  phone: string,
  customerId: string,
  data: { customerName: string; serviceName: string; barberName: string; frequencyLabel: string; confirmedCount: number; conflictCount: number }
) {
  return sendAutomated({ companyId, kind: "RECURRING_APPROVED", phone, customerId, vars: recurringApprovedVars(data) });
}

export async function sendRecurringRejected(
  companyId: string,
  phone: string,
  customerId: string,
  data: { customerName: string; serviceName: string; reason?: string }
) {
  return sendAutomated({ companyId, kind: "RECURRING_REJECTED", phone, customerId, vars: recurringRejectedVars(data) });
}

/** Tempo real: a barbearia marcou um horário avulso pro cliente. */
export async function sendAppointmentScheduledByShop(
  companyId: string,
  phone: string,
  customerId: string,
  data: AppointmentMessageData & { companyName: string; confirmUrl?: string | null }
) {
  return sendAutomated({ companyId, kind: "BOOKED_BY_SHOP", phone, customerId, vars: appointmentVars(data) });
}

/** Tempo real: a barbearia marcou o horário e a recorrência do cliente de uma vez. */
export async function sendRecurringScheduledByShop(
  companyId: string,
  phone: string,
  customerId: string,
  data: Parameters<typeof recurringBookedVars>[0]
) {
  return sendAutomated({ companyId, kind: "RECURRING_BOOKED_BY_SHOP", phone, customerId, vars: recurringBookedVars(data) });
}

/** Lembrete "é hoje" (manhã do dia). */
export async function sendMorningReminder(companyId: string, phone: string, customerId: string, data: Parameters<typeof morningVars>[0]) {
  return sendAutomated({ companyId, kind: "REMINDER_MORNING", phone, customerId, vars: morningVars(data) });
}

/** Resumo mensal: os horários do cliente no mês. */
export async function sendMonthlyRecurrenceNotice(companyId: string, phone: string, customerId: string, data: MonthlyMessageData) {
  return sendAutomated({ companyId, kind: "MONTHLY_SUMMARY", phone, customerId, vars: monthlyVars(data) });
}

/** Notifica o WhatsApp da barbearia sobre um novo agendamento recebido. */
export async function sendNewAppointmentAlertToShop(companyId: string, data: AppointmentMessageData & { status?: string }) {
  const phone = await barbershopNumber(companyId);
  if (!phone) {
    console.warn(
      "[WhatsApp] Número da barbearia indisponível (instância não conectada e BARBERSHOP_WHATSAPP_NUMBER não definido) — alerta não enviado."
    );
    return { ok: false as const, errorMessage: "Número da barbearia não configurado nem conectado." };
  }
  return sendWhatsapp({ companyId, phone, message: newAppointmentInternalTemplate(data) });
}

/** Notifica o WhatsApp da barbearia sobre uma nova solicitação de recorrência aguardando análise. */
export async function sendRecurringRequestAlertToShop(
  companyId: string,
  data: { customerName: string; serviceName: string; barberName: string; time: string; frequencyLabel: string; startDate: string; occurrencesLabel: string }
) {
  const phone = await barbershopNumber(companyId);
  if (!phone) {
    console.warn("[WhatsApp] Número da barbearia indisponível — alerta de recorrência não enviado.");
    return { ok: false as const, errorMessage: "Número da barbearia não configurado nem conectado." };
  }
  return sendWhatsapp({ companyId, phone, message: recurringRequestInternalTemplate(data) });
}

export async function sendCustomerOtp(companyId: string, phone: string, customerId: string, code: string, companyName: string) {
  return sendWhatsapp({
    companyId,
    phone,
    customerId,
    message: otpTemplate(code, companyName),
    logMessage: otpTemplate("••••••", companyName),
  });
}
