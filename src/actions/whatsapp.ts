"use server";

import { requireAdminOnly } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";
import {
  getEvolutionConfig,
  getEvolutionConnectionState,
  getEvolutionConnectedNumber,
  getEvolutionQrCode,
  logoutEvolutionInstance,
} from "@/lib/whatsapp/evolution-client";

function requireEvolutionConfig(companyId: string) {
  const config = getEvolutionConfig(companyId);
  if (!config) throw new Error("Integração do WhatsApp não está configurada nas variáveis de ambiente.");
  return config;
}

export async function getWhatsappQrCodeAction(): Promise<ActionResult<{ base64: string }>> {
  try {
    const user = await requireAdminOnly();
    const config = requireEvolutionConfig(user.companyId);

    const result = await getEvolutionQrCode(config);
    if ("error" in result) return actionError(new Error(result.error));
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function getWhatsappConnectionStateAction(): Promise<ActionResult<{ connected: boolean; phone?: string }>> {
  try {
    const user = await requireAdminOnly();
    const config = requireEvolutionConfig(user.companyId);

    const state = await getEvolutionConnectionState(config);
    const connected = state === "open";
    const phone = connected ? await getEvolutionConnectedNumber(config) : null;
    return actionSuccess({ connected, phone: phone ?? undefined });
  } catch (error) {
    return actionError(error);
  }
}

export async function disconnectWhatsappAction(): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const config = requireEvolutionConfig(user.companyId);

    const result = await logoutEvolutionInstance(config);
    if ("error" in result) return actionError(new Error(result.error));
  } catch (error) {
    return actionError(error);
  }
  return actionSuccess();
}
