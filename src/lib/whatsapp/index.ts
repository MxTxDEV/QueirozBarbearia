import "server-only";
import { prisma } from "@/lib/prisma";
import { MockWhatsAppProvider } from "./mock-provider";
import { CloudApiWhatsAppProvider } from "./cloud-api-provider";
import { EvolutionApiWhatsAppProvider } from "./evolution-provider";
import { getEvolutionConfig, getEvolutionConnectionState, getEvolutionConnectedNumber } from "./evolution-client";
import type { WhatsAppProvider, AppointmentMessageData } from "./types";
import {
  appointmentCancellationTemplate,
  appointmentConfirmationTemplate,
  appointmentReminderTemplate,
  newAppointmentInternalTemplate,
  otpTemplate,
} from "./templates";

export { appointmentCancellationTemplate, appointmentConfirmationTemplate, appointmentReminderTemplate, newAppointmentInternalTemplate };
export type { AppointmentMessageData };

let cachedProvider: WhatsAppProvider | null = null;

/** Fábrica do provedor de WhatsApp, controlada por variáveis de ambiente. */
function getProvider(): WhatsAppProvider {
  if (cachedProvider) return cachedProvider;

  const kind = process.env.WHATSAPP_PROVIDER ?? "mock";

  if (kind === "cloud_api") {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (apiUrl && apiKey && phoneNumberId) {
      cachedProvider = new CloudApiWhatsAppProvider(apiUrl, apiKey, phoneNumberId);
      return cachedProvider;
    }
  }

  if (kind === "evolution") {
    const config = getEvolutionConfig();
    if (config) {
      cachedProvider = new EvolutionApiWhatsAppProvider(config.apiUrl, config.apiKey, config.instanceName);
      return cachedProvider;
    }
  }

  cachedProvider = new MockWhatsAppProvider();
  return cachedProvider;
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

export async function whatsappConnectionStatus(): Promise<WhatsappStatus> {
  const configuredKind = (process.env.WHATSAPP_PROVIDER as WhatsappStatus["configuredKind"] | undefined) ?? "mock";

  if (configuredKind === "cloud_api") {
    const configured = !!process.env.WHATSAPP_API_URL && !!process.env.WHATSAPP_API_KEY && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    return { configuredKind, mode: configured ? "cloud_api" : "mock", connected: configured };
  }

  if (configuredKind === "evolution") {
    const config = getEvolutionConfig();
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
}) {
  const provider = getProvider();
  const result = await provider.sendMessage(params.phone, params.message);

  await prisma.whatsappMessage.create({
    data: {
      companyId: params.companyId,
      customerId: params.customerId,
      phone: params.phone,
      message: params.message,
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
    const config = getEvolutionConfig();
    if (config) {
      const connectedNumber = await getEvolutionConnectedNumber(config);
      if (connectedNumber) return connectedNumber;
    }
  }

  return process.env.BARBERSHOP_WHATSAPP_NUMBER ?? null;
}

export async function sendAppointmentConfirmation(
  companyId: string,
  phone: string,
  customerId: string,
  data: AppointmentMessageData
) {
  return sendWhatsapp({ companyId, phone, customerId, message: appointmentConfirmationTemplate(data) });
}

export async function sendAppointmentReminder(
  companyId: string,
  phone: string,
  customerId: string,
  data: AppointmentMessageData
) {
  return sendWhatsapp({ companyId, phone, customerId, message: appointmentReminderTemplate(data) });
}

export async function sendAppointmentCancellation(
  companyId: string,
  phone: string,
  customerId: string,
  data: Pick<AppointmentMessageData, "customerName" | "date" | "time">
) {
  return sendWhatsapp({ companyId, phone, customerId, message: appointmentCancellationTemplate(data) });
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

export async function sendCustomerOtp(companyId: string, phone: string, customerId: string, code: string) {
  return sendWhatsapp({ companyId, phone, customerId, message: otpTemplate(code) });
}
