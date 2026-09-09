"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const slugSchema = z
  .string()
  .min(2, "O identificador precisa ter ao menos 2 caracteres.")
  .max(60, "O identificador pode ter no máximo 60 caracteres.")
  .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen.")
  .refine((s) => !s.startsWith("-") && !s.endsWith("-"), "Não pode começar ou terminar com hífen.");

/**
 * Atualiza o slug público da própria empresa (link de /agendar/{slug}). Só o
 * ADMIN da empresa pode alterar, e só o slug da SUA PRÓPRIA empresa —
 * companyId sempre vem da sessão, nunca de um id enviado pelo formulário.
 * Em conflito, sugere o próximo disponível (ex: barbearia-imperial-2).
 */
export async function updateCompanySlugAction(_prev: ActionResult<{ slug: string }> | undefined, formData: FormData): Promise<ActionResult<{ slug: string }>> {
  try {
    const user = await requireAdminOnly();
    const raw = String(formData.get("slug") ?? "").trim().toLowerCase();
    const slug = slugSchema.parse(raw);

    const existing = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== user.companyId) {
      const suggestion = await suggestAvailableSlug(slug);
      return actionError(new Error(`Este identificador já está em uso. Sugestão: "${suggestion}".`));
    }

    await prisma.company.update({ where: { id: user.companyId }, data: { slug } });

    revalidatePath("/admin/settings");
    revalidatePath(`/agendar/${slug}`);
    return actionSuccess({ slug });
  } catch (error) {
    return actionError(error);
  }
}

/** Encontra o próximo slug livre no formato "base-2", "base-3"... até achar um disponível. */
async function suggestAvailableSlug(base: string): Promise<string> {
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    const taken = await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Liga/desliga o agendamento online da própria empresa — some de /agendar e mostra indisponibilidade em /agendar/{slug} quando desligado. */
export async function toggleOnlineBookingAction(enabled: boolean): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    await prisma.company.update({ where: { id: user.companyId }, data: { onlineBookingEnabled: enabled } });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/agendar");
  return actionSuccess();
}
