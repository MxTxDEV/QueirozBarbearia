"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const productSchema = z.object({
  name: z.string().min(2, "Informe o nome do produto."),
  price: z.coerce.number().positive("O preço deve ser maior que zero."),
});

export async function createProductAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = productSchema.parse({
      name: formData.get("name"),
      price: formData.get("price"),
    });

    await prisma.product.create({
      data: { ...data, companyId: user.companyId },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProductAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = productSchema.parse({
      name: formData.get("name"),
      price: formData.get("price"),
    });

    const result = await prisma.product.updateMany({
      where: { id, companyId: user.companyId },
      data,
    });
    if (result.count === 0) return actionError(new Error("Produto não encontrado."));
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/products");
  return actionSuccess();
}

export async function toggleProductActiveAction(id: string, active: boolean) {
  const user = await requireAdminContext();
  await prisma.product.updateMany({ where: { id, companyId: user.companyId }, data: { active } });
  revalidatePath("/admin/products");
}
