import "server-only";
import { prisma } from "@/lib/prisma";
import { MockWhatsAppProvider } from "./mock-provider";
import { CloudApiWhatsAppProvider } from "./cloud-api-provider";
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
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (kind === "cloud_api" && apiUrl && apiKey && phoneNumberId) {
    cachedProvider = new CloudApiWhatsAppProvider(apiUrl, apiKey, phoneNumberId);
  } else {
    cachedProvider = new MockWhatsAppProvider();
  }
  return cachedProvider;
}

export function whatsappConnectionStatus() {
  const kind = process.env.WHATSAPP_PROVIDER ?? "mock";
  const configured = kind === "cloud_api" && !!process.env.WHATSAPP_API_URL && !!process.env.WHATSAPP_API_KEY && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  return {
    mode: configured ? "cloud_api" : "mock",
    connected: configured,
  } as const;
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

/** Número da barbearia para alertas internos — busca a configuração da empresa, com fallback global. */
async function barbershopNumber(companyId: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: { companyId_key: { companyId, key: "shop_whatsapp" } },
  });
  return setting?.value ?? process.env.BARBERSHOP_WHATSAPP_NUMBER ?? "+5531995797674";
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
  return sendWhatsapp({ companyId, phone, message: newAppointmentInternalTemplate(data) });
}

export async function sendCustomerOtp(companyId: string, phone: string, customerId: string, code: string) {
  return sendWhatsapp({ companyId, phone, customerId, message: otpTemplate(code) });
}
