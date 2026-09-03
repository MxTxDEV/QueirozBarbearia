"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createUserSession, destroySession, verifyPassword, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/action-helpers";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// Hash de custo equivalente a uma senha real, usado só para gastar o mesmo
// tempo de bcrypt quando o e-mail não existe — sem isso, uma resposta rápida
// (sem hash pra comparar) daria a quem ataca um jeito de descobrir por
// tempo de resposta quais e-mails têm conta, mesmo com a mensagem genérica.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8p8s8+9HqzWvS3T92CIcVWO/PzY.9O";

export async function loginAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let isSuperAdmin = false;
  try {
    const data = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.active) {
      await verifyPassword(data.password, DUMMY_HASH);
      return actionError(new Error("Credenciais inválidas."));
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
      return actionError(new Error(`Muitas tentativas de login. Tente novamente em ${minutesLeft} min.`));
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockingNow = attempts >= MAX_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: lockingNow
          ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
          : { failedLoginAttempts: attempts },
      });
      return actionError(
        new Error(lockingNow ? `Muitas tentativas de login. Tente novamente em ${LOCKOUT_MINUTES} min.` : "Credenciais inválidas.")
      );
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    await createUserSession(user.id);
    isSuperAdmin = user.role === "SUPERADMIN";
    await logAudit({ companyId: user.companyId, userId: user.id, action: "login", entityType: "user", entityId: user.id });
  } catch (error) {
    return actionError(error);
  }

  redirect(isSuperAdmin ? "/superadmin/dashboard" : "/admin/dashboard");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({ companyId: user.companyId, userId: user.id, action: "logout", entityType: "user", entityId: user.id });
  }
  await destroySession();
  redirect("/login");
}
