"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/require-admin";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const createCompanySchema = z.object({
  name: z.string().min(2, "Informe o nome da barbearia."),
  slug: z.string().min(2, "Informe um identificador de URL.").regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
  whatsapp: z.string().optional().or(z.literal("")),
  adminName: z.string().min(2, "Informe o nome do administrador."),
  adminEmail: z.string().email("E-mail inválido."),
  adminPassword: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

/**
 * Cria uma nova empresa (tenant) + seu usuário ADMIN inicial + configurações
 * padrão, tudo em uma única transação: ou tudo é criado, ou nada é. Só o
 * SUPERADMIN pode chamar esta action.
 */
export async function createCompanyAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let newCompanyId: string;
  try {
    const superAdmin = await requireSuperAdmin();
    const data = createCompanySchema.parse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      whatsapp: formData.get("whatsapp"),
      adminName: formData.get("adminName"),
      adminEmail: formData.get("adminEmail"),
      adminPassword: formData.get("adminPassword"),
    });

    const existingSlug = await prisma.company.findUnique({ where: { slug: data.slug } });
    if (existingSlug) return actionError(new Error("Já existe uma empresa com este identificador de URL."));

    const existingEmail = await prisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existingEmail) return actionError(new Error("Já existe um usuário com este e-mail."));

    const passwordHash = await hashPassword(data.adminPassword);

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: data.name,
          tradeName: data.name,
          slug: data.slug,
          whatsapp: data.whatsapp || undefined,
          status: "ACTIVE",
        },
      });

      await tx.user.create({
        data: {
          companyId: created.id,
          name: data.adminName,
          email: data.adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      await tx.systemSetting.create({
        data: { companyId: created.id, key: "system_name", value: created.name },
      });

      return created;
    });

    newCompanyId = company.id;

    await logAudit({
      companyId: company.id,
      userId: superAdmin.id,
      action: "company_created",
      entityType: "company",
      entityId: company.id,
      metadata: { name: company.name, slug: company.slug, adminEmail: data.adminEmail },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/superadmin/companies");
  redirect(`/superadmin/companies/${newCompanyId}`);
}

const updateCompanySchema = z.object({
  name: z.string().min(2, "Informe o nome da barbearia."),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export async function updateCompanyAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = updateCompanySchema.parse({
      name: formData.get("name"),
      whatsapp: formData.get("whatsapp"),
      email: formData.get("email"),
      phone: formData.get("phone"),
    });

    await prisma.company.update({
      where: { id },
      data: {
        name: data.name,
        tradeName: data.name,
        whatsapp: data.whatsapp || null,
        email: data.email || null,
        phone: data.phone || null,
      },
    });

    await logAudit({
      companyId: id,
      userId: superAdmin.id,
      action: "company_updated",
      entityType: "company",
      entityId: id,
      metadata: { name: data.name },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/superadmin/companies/${id}`);
  revalidatePath("/superadmin/companies");
  return actionSuccess();
}

const STATUS_ACTION_LABEL: Record<"ACTIVE" | "SUSPENDED" | "BLOCKED", string> = {
  ACTIVE: "company_activated",
  SUSPENDED: "company_suspended",
  BLOCKED: "company_blocked",
};

export async function updateCompanyStatusAction(id: string, status: "ACTIVE" | "SUSPENDED" | "BLOCKED") {
  const superAdmin = await requireSuperAdmin();
  await prisma.company.update({ where: { id }, data: { status } });
  await logAudit({
    companyId: id,
    userId: superAdmin.id,
    action: STATUS_ACTION_LABEL[status],
    entityType: "company",
    entityId: id,
  });
  revalidatePath(`/superadmin/companies/${id}`);
  revalidatePath("/superadmin/companies");
}

const createUserSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  role: z.enum(["ADMIN", "BARBER"]),
});

/** Cria um usuário (ADMIN ou BARBER) para uma empresa existente. */
export async function createCompanyUserAction(
  companyId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = createUserSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    });

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return actionError(new Error("Já existe um usuário com este e-mail."));

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { companyId, name: data.name, email: data.email, passwordHash, role: data.role },
    });

    await logAudit({
      companyId,
      userId: superAdmin.id,
      action: "user_created",
      entityType: "user",
      entityId: user.id,
      metadata: { email: data.email, role: data.role },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/superadmin/companies/${companyId}`);
  revalidatePath("/superadmin/users");
  return actionSuccess();
}

export async function toggleUserActiveAction(userId: string, active: boolean) {
  const superAdmin = await requireSuperAdmin();
  const user = await prisma.user.update({ where: { id: userId }, data: { active } });
  await logAudit({
    companyId: user.companyId,
    userId: superAdmin.id,
    action: active ? "user_activated" : "user_blocked",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/superadmin/users");
  if (user.companyId) revalidatePath(`/superadmin/companies/${user.companyId}`);
}
