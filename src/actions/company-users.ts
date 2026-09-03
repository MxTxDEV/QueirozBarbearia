"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const createUserSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  role: z.enum(["ADMIN", "BARBER"]),
  barberId: z.string().optional().or(z.literal("")),
});

/**
 * Cria um usuário (ADMIN ou BARBER) para a própria empresa do ADMIN logado.
 * companyId vem sempre da sessão, nunca de input do cliente — o mesmo
 * padrão usado em toda a base para isolamento entre empresas. Papel restrito
 * a ADMIN/BARBER (nunca SUPERADMIN), então não há risco de escalonamento de
 * privilégio mesmo sendo self-service.
 */
export async function createCompanyUserAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdminOnly();
    const data = createUserSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
      barberId: formData.get("barberId") ?? "",
    });

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return actionError(new Error("Já existe um usuário com este e-mail."));

    let barberId: string | null = null;
    if (data.role === "BARBER" && data.barberId) {
      const barber = await prisma.barber.findFirst({
        where: { id: data.barberId, companyId: admin.companyId, userId: null },
        select: { id: true },
      });
      if (!barber) return actionError(new Error("Barbeiro inválido ou já vinculado a outro usuário."));
      barberId = barber.id;
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        companyId: admin.companyId,
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
    });

    if (barberId) {
      await prisma.barber.updateMany({ where: { id: barberId, companyId: admin.companyId }, data: { userId: user.id } });
    }

    await logAudit({
      companyId: admin.companyId,
      userId: admin.id,
      action: "user_created",
      entityType: "user",
      entityId: user.id,
      metadata: { email: data.email, role: data.role },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/barbers");
  return actionSuccess();
}

export async function toggleCompanyUserActiveAction(userId: string, active: boolean): Promise<void> {
  const admin = await requireAdminOnly();
  if (userId === admin.id) return;

  const result = await prisma.user.updateMany({
    where: { id: userId, companyId: admin.companyId },
    data: { active },
  });
  if (result.count === 0) return;

  await logAudit({
    companyId: admin.companyId,
    userId: admin.id,
    action: active ? "user_activated" : "user_blocked",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/users");
}
