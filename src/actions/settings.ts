"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext, requireAdminOnly } from "@/lib/require-admin";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const schema = z.object({ systemName: z.string().min(2, "Informe um nome.") });

export async function updateSystemNameAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = schema.parse({ systemName: formData.get("systemName") });

    await prisma.systemSetting.upsert({
      where: { companyId_key: { companyId: user.companyId, key: "system_name" } },
      update: { value: data.systemName },
      create: { companyId: user.companyId, key: "system_name", value: data.systemName },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/settings");
  return actionSuccess();
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const currentUser = await requireAdminContext();
    const data = passwordSchema.parse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user) return actionError(new Error("Usuário não encontrado."));

    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) return actionError(new Error("Senha atual incorreta."));

    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  } catch (error) {
    return actionError(error);
  }

  return actionSuccess();
}
