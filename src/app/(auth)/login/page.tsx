import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSeed, ensureSuperAdmin } from "@/lib/seed";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/admin/dashboard");

  // Autoconfiguração: se o banco ainda não tem nenhum administrador de
  // empresa (primeiro acesso em um ambiente novo), popula a empresa de
  // demonstração inteira. Já em bancos com empresas reais (produção
  // existente antes do multi-tenant), isso não roda de novo — mas o
  // SUPERADMIN da plataforma precisa existir de qualquer forma, então é
  // garantido separadamente (idempotente, custo desprezível).
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount === 0) {
    await runSeed();
  } else {
    await ensureSuperAdmin();
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold text-foreground">Painel administrativo</h1>
        <p className="text-sm text-foreground-muted">Entre para gerenciar sua barbearia.</p>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
