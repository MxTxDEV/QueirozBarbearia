"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext, requireAdminOnly } from "@/lib/require-admin";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { saveUploadedLogo, deleteUploadedLogo, saveUploadedCoverImage, deleteUploadedCoverImage } from "@/lib/uploads";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const nameSchema = z.object({ systemName: z.string().min(2, "Informe um nome.") });

/**
 * Atualiza o nome do sistema e, opcionalmente, a logo — por upload de
 * arquivo (prioridade) ou por URL externa. Se os dois campos vierem
 * vazios, a logo atual não é alterada (evita apagar sem querer ao salvar
 * só o nome) — para remover, usa removeLogoAction.
 */
export async function updateBrandingAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = nameSchema.parse({ systemName: formData.get("systemName") });

    await prisma.systemSetting.upsert({
      where: { companyId_key: { companyId: user.companyId, key: "system_name" } },
      update: { value: data.systemName },
      create: { companyId: user.companyId, key: "system_name", value: data.systemName },
    });

    const file = formData.get("logoFile");
    const urlInput = String(formData.get("logoUrl") ?? "").trim();

    if (file instanceof File && file.size > 0) {
      const current = await prisma.company.findUnique({ where: { id: user.companyId }, select: { logoUrl: true } });
      const newLogoUrl = await saveUploadedLogo(file, user.companyId);
      await deleteUploadedLogo(current?.logoUrl);
      await prisma.company.update({ where: { id: user.companyId }, data: { logoUrl: newLogoUrl } });
    } else if (urlInput) {
      if (!/^https:\/\/.+/.test(urlInput)) {
        return actionError(new Error("Informe uma URL https:// de imagem válida, ou envie um arquivo."));
      }
      const current = await prisma.company.findUnique({ where: { id: user.companyId }, select: { logoUrl: true } });
      if (current?.logoUrl !== urlInput) await deleteUploadedLogo(current?.logoUrl);
      await prisma.company.update({ where: { id: user.companyId }, data: { logoUrl: urlInput } });
    }
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  return actionSuccess();
}

export async function removeLogoAction() {
  const user = await requireAdminOnly();
  const current = await prisma.company.findUnique({ where: { id: user.companyId }, select: { logoUrl: true } });
  await deleteUploadedLogo(current?.logoUrl);
  await prisma.company.update({ where: { id: user.companyId }, data: { logoUrl: null } });

  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
}

/**
 * Atualiza a foto de capa usada nos cards de /agendar e no topo de
 * /agendar/{slug} — por upload de arquivo (prioridade) ou por URL externa.
 * Independente da logo (Company.coverImageUrl é um campo separado).
 */
export async function updateCoverImageAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const file = formData.get("coverFile");
    const urlInput = String(formData.get("coverUrl") ?? "").trim();

    if (file instanceof File && file.size > 0) {
      const current = await prisma.company.findUnique({ where: { id: user.companyId }, select: { coverImageUrl: true } });
      const newCoverUrl = await saveUploadedCoverImage(file, user.companyId);
      await deleteUploadedCoverImage(current?.coverImageUrl);
      await prisma.company.update({ where: { id: user.companyId }, data: { coverImageUrl: newCoverUrl } });
    } else if (urlInput) {
      if (!/^https:\/\/.+/.test(urlInput)) {
        return actionError(new Error("Informe uma URL https:// de imagem válida, ou envie um arquivo."));
      }
      const current = await prisma.company.findUnique({ where: { id: user.companyId }, select: { coverImageUrl: true } });
      if (current?.coverImageUrl !== urlInput) await deleteUploadedCoverImage(current?.coverImageUrl);
      await prisma.company.update({ where: { id: user.companyId }, data: { coverImageUrl: urlInput } });
    }
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/agendar");
  return actionSuccess();
}

export async function removeCoverImageAction() {
  const user = await requireAdminOnly();
  const current = await prisma.company.findUnique({ where: { id: user.companyId }, select: { coverImageUrl: true } });
  await deleteUploadedCoverImage(current?.coverImageUrl);
  await prisma.company.update({ where: { id: user.companyId }, data: { coverImageUrl: null } });

  revalidatePath("/admin/settings");
  revalidatePath("/agendar");
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
