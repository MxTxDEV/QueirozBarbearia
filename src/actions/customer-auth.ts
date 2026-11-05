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
import { isCustomerProfileIncomplete, PLACEHOLDER_CUSTOMER_NAME } from "@/lib/require-customer";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const requestSchema = z.object({
  whatsapp: z.string().min(8, "Informe um número de WhatsApp válido."),
  companySlug: z.string().min(1),
});

/**
 * Etapa 1 do login do cliente: recebe o WhatsApp, cria o cadastro caso não
 * exista, gera um código OTP e envia via WhatsApp (mock em desenvolvimento).
 * O companySlug vem do formulário (preenchido pela própria página com base
 * na URL /portal/[company]/login) e é resolvido para um companyId real
 * aqui — nunca aceito como companyId diretamente do cliente.
 */
export async function requestCustomerOtpAction(
  _prev: ActionResult<{ customerId: string; whatsapp: string }> | undefined,
  formData: FormData
): Promise<ActionResult<{ customerId: string; whatsapp: string }>> {
  try {
    const data = requestSchema.parse({
      whatsapp: formData.get("whatsapp"),
      companySlug: formData.get("companySlug"),
    });
    const whatsapp = normalizeWhatsapp(data.whatsapp);
    if (!whatsapp) return actionError(new Error("Número de WhatsApp inválido. Use o formato (DD) 9XXXX-XXXX."));

    const company = await prisma.company.findUnique({ where: { slug: data.companySlug }, select: { id: true, name: true, status: true } });
    if (!company || company.status !== "ACTIVE") return actionError(new Error("Empresa não encontrada ou indisponível."));

    const customer = await prisma.customer.upsert({
      where: { companyId_whatsapp: { companyId: company.id, whatsapp } },
      update: {},
      create: { companyId: company.id, fullName: PLACEHOLDER_CUSTOMER_NAME, whatsapp },
    });

    const code = await createCustomerOtp(customer.id);
    // Código pedido há instantes: o anterior continua valendo, não manda outro (e não dá erro).
    if (code) {
      const sent = await sendCustomerOtp(company.id, whatsapp, customer.id, code, company.name);
      if (!sent.ok) {
        return actionError(new Error("Não conseguimos enviar o código pelo WhatsApp agora. Confira o número e tente de novo em instantes."));
      }
    }

    return actionSuccess({ customerId: customer.id, whatsapp });
  } catch (error) {
    return actionError(error);
  }
}

const verifySchema = z.object({
  customerId: z.string().min(1),
  code: z.string().min(4, "Informe o código recebido."),
  companySlug: z.string().min(1),
});

export async function verifyCustomerOtpAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let companySlug = "";
  let destination = "";
  try {
    const data = verifySchema.parse({
      customerId: formData.get("customerId"),
      code: formData.get("code"),
      companySlug: formData.get("companySlug"),
    });
    companySlug = data.companySlug;

    const valid = await verifyCustomerOtp(data.customerId, data.code);
    if (!valid) return actionError(new Error("Código inválido ou expirado."));

    await createCustomerSession(data.customerId);
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, select: { fullName: true } });
    // Primeira vez: só falta o nome. Quem já tem cadastro cai direto na tela de agendar.
    destination = customer && !isCustomerProfileIncomplete(customer) ? `/portal/${companySlug}/book` : `/portal/${companySlug}/profile`;
  } catch (error) {
    return actionError(error);
  }

  redirect(destination);
}

export async function logoutCustomerAction(companySlug: string) {
  await destroyCustomerSession();
  redirect(`/portal/${companySlug}/login`);
}
