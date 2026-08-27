import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/** Garante que o usuário logado é ADMIN ou BARBER; redireciona para /login caso contrário. */
export async function requireAdminContext() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "BARBER") redirect("/login");
  return user;
}

export async function requireAdminOnly() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/admin/dashboard");
  return user;
}
