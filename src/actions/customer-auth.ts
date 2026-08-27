"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeWhatsapp } from "@/lib/utils";
import {
  createCustomerOtp,
  createCustomerSession,
  destroyCustomerSession,
  verifyCustomerOtp,
} from "@/lib/customer-auth";
import { sendCustomerOtp } from "@/lib/whatsapp";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const requestSchema = z.object({
  whatsapp: z.string().min(8, "Informe um número de WhatsApp válido."),
});

/**
 * Etapa 1 do login do cliente: recebe o WhatsApp, cria o cadastro caso não
 * exista, gera um código OTP e envia via WhatsApp (mock em desenvolvimento).
 */
export async function requestCustomerOtpAction(
  _prev: ActionResult<{ customerId: string; whatsapp: string }> | undefined,
  formData: FormData
): Promise<ActionResult<{ customerId: string; whatsapp: string }>> {
  try {
    const data = requestSchema.parse({ whatsapp: formData.get("whatsapp") });
    const whatsapp = normalizeWhatsapp(data.whatsapp);
    if (!whatsapp) return actionError(new Error("Número de WhatsApp inválido. Use o formato (DD) 9XXXX-XXXX."));

    const customer = await prisma.customer.upsert({
      where: { whatsapp },
      update: {},
      create: { fullName: "Cliente", whatsapp },
    });

    const code = await createCustomerOtp(customer.id);
    await sendCustomerOtp(whatsapp, customer.id, code);

    return actionSuccess({ customerId: customer.id, whatsapp });
  } catch (error) {
    return actionError(error);
  }
}

const verifySchema = z.object({
  customerId: z.string().min(1),
  code: z.string().min(4, "Informe o código recebido."),
});

export async function verifyCustomerOtpAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const data = verifySchema.parse({
      customerId: formData.get("customerId"),
      code: formData.get("code"),
    });

    const valid = await verifyCustomerOtp(data.customerId, data.code);
    if (!valid) return actionError(new Error("Código inválido ou expirado."));

    await createCustomerSession(data.customerId);
  } catch (error) {
    return actionError(error);
  }

  redirect("/portal/dashboard");
}

export async function logoutCustomerAction() {
  await destroyCustomerSession();
  redirect("/portal/login");
}
