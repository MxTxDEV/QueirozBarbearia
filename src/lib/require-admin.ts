import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/** Usuário de empresa autenticado — companyId nunca é nulo aqui (garantido em runtime). */
export type CompanyUser = CurrentUser & { companyId: string };

/**
 * Garante que o usuário logado é ADMIN ou BARBER de uma empresa (nunca
 * SUPERADMIN — esse usa requireSuperAdmin). Redireciona para /login se não
 * autenticado/autorizado, e para /suspended se a empresa estiver bloqueada
 * ou suspensa. O companyId retornado vem sempre da sessão no banco, nunca
 * de input do cliente (URL, formData, headers) — é a raiz do isolamento
 * entre tenants em todas as consultas subsequentes.
 */
export async function requireAdminContext(): Promise<CompanyUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "BARBER") redirect("/login");
  if (!user.companyId) redirect("/login");
  if (user.companyStatus === "BLOCKED" || user.companyStatus === "SUSPENDED") redirect("/suspended");
  return user as CompanyUser;
}

export async function requireAdminOnly(): Promise<CompanyUser> {
  const user = await requireAdminContext();
  if (user.role !== "ADMIN") redirect("/admin/dashboard");
  return user;
}

/** Garante o SUPERADMIN da plataforma (nunca pertence a uma empresa). */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/login");
  return user;
}
