"use server";

import { requireAdminOnly } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";
import { getEvolutionConfig, getEvolutionConnectionState, getEvolutionQrCode, logoutEvolutionInstance } from "@/lib/whatsapp/evolution-client";

function requireEvolutionConfig() {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não está configurado nas variáveis de ambiente.");
  return config;
}

export async function getWhatsappQrCodeAction(): Promise<ActionResult<{ base64: string }>> {
  try {
    await requireAdminOnly();
    const config = requireEvolutionConfig();

    const result = await getEvolutionQrCode(config);
    if ("error" in result) return actionError(new Error(result.error));
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function getWhatsappConnectionStateAction(): Promise<ActionResult<{ connected: boolean }>> {
  try {
    await requireAdminOnly();
    const config = requireEvolutionConfig();

    const state = await getEvolutionConnectionState(config);
    return actionSuccess({ connected: state === "open" });
  } catch (error) {
    return actionError(error);
  }
}

export async function disconnectWhatsappAction(): Promise<ActionResult> {
  try {
    await requireAdminOnly();
    const config = requireEvolutionConfig();

    const result = await logoutEvolutionInstance(config);
    if ("error" in result) return actionError(new Error(result.error));
  } catch (error) {
    return actionError(error);
  }
  return actionSuccess();
}
