"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const serviceSchema = z.object({
  name: z.string().min(2, "Informe o nome do serviço."),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().positive("O preço deve ser maior que zero."),
  durationMinutes: z.coerce.number().int().positive("Informe a duração em minutos."),
});

export async function createServiceAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      durationMinutes: formData.get("durationMinutes"),
    });

    await prisma.service.create({
      data: { ...data, companyId: user.companyId, description: data.description || undefined },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/services");
  redirect("/admin/services");
}

export async function updateServiceAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      durationMinutes: formData.get("durationMinutes"),
    });

    const result = await prisma.service.updateMany({
      where: { id, companyId: user.companyId },
      data: { ...data, description: data.description || null },
    });
    if (result.count === 0) return actionError(new Error("Serviço não encontrado."));
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/services");
  return actionSuccess();
}

export async function toggleServiceActiveAction(id: string, active: boolean) {
  const user = await requireAdminContext();
  await prisma.service.updateMany({ where: { id, companyId: user.companyId }, data: { active } });
  revalidatePath("/admin/services");
}
