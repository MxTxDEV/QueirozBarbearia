"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { normalizeWhatsapp } from "@/lib/utils";
import { sendWhatsapp } from "@/lib/whatsapp";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const customerSchema = z.object({
  fullName: z.string().min(2, "Informe o nome completo."),
  whatsapp: z.string().min(8, "Informe um WhatsApp válido."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function createCustomerAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let newCustomerId: string;
  try {
    const user = await requireAdminContext();
    const parsed = customerSchema.parse({
      fullName: formData.get("fullName"),
      whatsapp: formData.get("whatsapp"),
      email: formData.get("email"),
      birthDate: formData.get("birthDate"),
      notes: formData.get("notes"),
    });

    const whatsapp = normalizeWhatsapp(parsed.whatsapp);
    if (!whatsapp) return actionError(new Error("Número de WhatsApp inválido. Use o formato (DD) 9XXXX-XXXX."));

    const existing = await prisma.customer.findUnique({ where: { companyId_whatsapp: { companyId: user.companyId, whatsapp } } });
    if (existing) return actionError(new Error("Já existe um cliente cadastrado com este WhatsApp."));

    const created = await prisma.customer.create({
      data: {
        companyId: user.companyId,
        fullName: parsed.fullName,
        whatsapp,
        email: parsed.email || undefined,
        birthDate: parsed.birthDate ? new Date(parsed.birthDate) : undefined,
        notes: parsed.notes || undefined,
      },
    });
    newCustomerId = created.id;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${newCustomerId}`);
}

export async function updateCustomerAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const parsed = customerSchema.parse({
      fullName: formData.get("fullName"),
      whatsapp: formData.get("whatsapp"),
      email: formData.get("email"),
      birthDate: formData.get("birthDate"),
      notes: formData.get("notes"),
    });

    const whatsapp = normalizeWhatsapp(parsed.whatsapp);
    if (!whatsapp) return actionError(new Error("Número de WhatsApp inválido."));

    const existing = await prisma.customer.findUnique({ where: { companyId_whatsapp: { companyId: user.companyId, whatsapp } } });
    if (existing && existing.id !== id) return actionError(new Error("Já existe outro cliente com este WhatsApp."));

    const result = await prisma.customer.updateMany({
      where: { id, companyId: user.companyId },
      data: {
        fullName: parsed.fullName,
        whatsapp,
        email: parsed.email || null,
        birthDate: parsed.birthDate ? new Date(parsed.birthDate) : null,
        notes: parsed.notes || null,
      },
    });
    if (result.count === 0) return actionError(new Error("Cliente não encontrado."));
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return actionSuccess();
}

const messageSchema = z.object({ message: z.string().min(1, "Digite uma mensagem.") });

export async function sendCustomerMessageAction(
  customerId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const parsed = messageSchema.parse({ message: formData.get("message") });

    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: user.companyId } });
    if (!customer) return actionError(new Error("Cliente não encontrado."));

    const result = await sendWhatsapp({ companyId: user.companyId, phone: customer.whatsapp, customerId, message: parsed.message });
    if (!result.ok) return actionError(new Error(result.errorMessage ?? "Falha ao enviar mensagem."));
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/admin/customers/${customerId}`);
  return actionSuccess();
}
