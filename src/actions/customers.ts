"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminContext, requireAdminOnly } from "@/lib/require-admin";
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

const BLOCKED_BY_HISTORY =
  "Não é possível excluir: este cliente possui histórico de agendamentos ou pagamentos.";

/**
 * Detecta a violação da FK RESTRICT que protege o histórico do cliente.
 *
 * Não dá para confiar só no código do Prisma: o Postgres emite SQLSTATE
 * 23503 (foreign_key_violation) em algumas versões e 23001
 * (restrict_violation) em outras para o mesmo ON DELETE RESTRICT, e o
 * Prisma só mapeia 23503 para P2003 — no caso do 23001 o ConnectorError
 * cru vaza sem `code`. Por isso a checagem cobre as duas formas; ela é
 * apenas a rede de segurança para a corrida entre a verificação abaixo e
 * o DELETE (alguém criar um agendamento nesse intervalo).
 */
function isHistoryConstraintViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return true;
  const message = error instanceof Error ? error.message : "";
  return /23001|23503|restrict_violation|foreign key constraint/i.test(message);
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();

    const customer = await prisma.customer.findFirst({
      where: { id, companyId: user.companyId },
      include: { _count: { select: { appointments: true, payments: true } } },
    });
    if (!customer) return actionError(new Error("Cliente não encontrado."));

    // Verificação explícita antes do DELETE: determinística e independente
    // de como o banco/Prisma reportam a violação da FK.
    const { appointments, payments } = customer._count;
    if (appointments > 0 || payments > 0) {
      const partes: string[] = [];
      if (appointments > 0) partes.push(`${appointments} agendamento(s)`);
      if (payments > 0) partes.push(`${payments} pagamento(s)`);
      return actionError(
        new Error(`Não é possível excluir: este cliente possui ${partes.join(" e ")} no histórico.`)
      );
    }

    await prisma.customer.delete({ where: { id } });
  } catch (error) {
    if (isHistoryConstraintViolation(error)) return actionError(new Error(BLOCKED_BY_HISTORY));
    return actionError(error);
  }

  revalidatePath("/admin/customers");
  redirect("/admin/customers");
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
