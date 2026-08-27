import "server-only";
import { prisma } from "@/lib/prisma";
import { MockWhatsAppProvider } from "./mock-provider";
import { CloudApiWhatsAppProvider } from "./cloud-api-provider";
import { EvolutionApiWhatsAppProvider } from "./evolution-provider";
import { getEvolutionConfig, getEvolutionConnectionState } from "./evolution-client";
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
    return { configuredKind, mode: "evolution", connected: state === "open" };
  }

  return { configuredKind: "mock", mode: "mock", connected: false };
}

/**
 * Envia uma mensagem de WhatsApp e persiste o registro em `whatsapp_messages`,
 * independentemente do provedor configurado. Todo envio (sucesso ou falha)
 * fica registrado para auditoria na tela de configurações.
 */
export async function sendWhatsapp(params: {
  phone: string;
  message: string;
  customerId?: string;
}) {
  const provider = getProvider();
  const result = await provider.sendMessage(params.phone, params.message);

  await prisma.whatsappMessage.create({
    data: {
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

function barbershopNumber() {
  return process.env.BARBERSHOP_WHATSAPP_NUMBER ?? "+5531995797674";
}

export async function sendAppointmentConfirmation(phone: string, customerId: string, data: AppointmentMessageData) {
  return sendWhatsapp({ phone, customerId, message: appointmentConfirmationTemplate(data) });
}

export async function sendAppointmentReminder(phone: string, customerId: string, data: AppointmentMessageData) {
  return sendWhatsapp({ phone, customerId, message: appointmentReminderTemplate(data) });
}

export async function sendAppointmentCancellation(
  phone: string,
  customerId: string,
  data: Pick<AppointmentMessageData, "customerName" | "date" | "time">
) {
  return sendWhatsapp({ phone, customerId, message: appointmentCancellationTemplate(data) });
}

/** Notifica o WhatsApp da barbearia sobre um novo agendamento recebido. */
export async function sendNewAppointmentAlertToShop(data: AppointmentMessageData & { status?: string }) {
  return sendWhatsapp({ phone: barbershopNumber(), message: newAppointmentInternalTemplate(data) });
}

export async function sendCustomerOtp(phone: string, customerId: string, code: string) {
  return sendWhatsapp({ phone, customerId, message: otpTemplate(code) });
}
