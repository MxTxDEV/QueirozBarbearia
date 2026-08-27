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
    await requireAdminContext();
    const data = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      durationMinutes: formData.get("durationMinutes"),
    });

    await prisma.service.create({
      data: { ...data, description: data.description || undefined },
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
    await requireAdminContext();
    const data = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      durationMinutes: formData.get("durationMinutes"),
    });

    await prisma.service.update({
      where: { id },
      data: { ...data, description: data.description || null },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/services");
  return actionSuccess();
}

export async function toggleServiceActiveAction(id: string, active: boolean) {
  await requireAdminContext();
  await prisma.service.update({ where: { id }, data: { active } });
  revalidatePath("/admin/services");
}
