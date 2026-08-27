"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createUserSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export async function loginAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const data = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.active) return actionError(new Error("Credenciais inválidas."));

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) return actionError(new Error("Credenciais inválidas."));

    await createUserSession(user.id);
  } catch (error) {
    return actionError(error);
  }

  redirect("/admin/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

/** Cadastro de administrador — usado apenas para o setup inicial do sistema. */
export async function registerAdminAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const data = registerSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return actionError(new Error("Já existe um usuário com este e-mail."));

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: "ADMIN" },
    });

    await createUserSession(user.id);
  } catch (error) {
    return actionError(error);
  }

  redirect("/admin/dashboard");
}
