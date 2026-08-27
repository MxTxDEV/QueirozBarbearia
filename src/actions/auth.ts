"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createUserSession, destroySession, verifyPassword } from "@/lib/auth";
import { actionError, type ActionResult } from "@/lib/action-helpers";

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
