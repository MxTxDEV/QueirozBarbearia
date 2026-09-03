import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSeed, ensureSuperAdmin } from "@/lib/seed";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  // Manda pro painel certo conforme o papel — mandar todo mundo pra
  // /admin/dashboard incondicionalmente fazia um SUPERADMIN já logado
  // entrar num loop: /login manda pro admin, o admin exige role
  // ADMIN/BARBER e manda de volta pro /login, e assim por diante (o
  // navegador chega a bloquear a navegação de tantos redirecionamentos).
  if (user) redirect(user.role === "SUPERADMIN" ? "/superadmin/dashboard" : "/admin/dashboard");

  // Autoconfiguração: se o banco ainda não tem nenhum administrador de
  // empresa (primeiro acesso em um ambiente novo), popula a empresa de
  // demonstração inteira. Já em bancos com empresas reais (produção
  // existente antes do multi-tenant), isso não roda de novo — mas o
  // SUPERADMIN da plataforma precisa existir de qualquer forma, então é
  // garantido separadamente (idempotente, custo desprezível).
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount === 0) {
    const result = await runSeed();
    // Só existe esse instante para capturar a senha gerada — depois só o hash
    // fica salvo. Vai para o log do servidor (Coolify/VPS), nunca pro cliente.
    if (result.credentials.superAdmin) {
      console.log(`[seed] Super Admin criado: ${result.credentials.superAdmin.email} / senha: ${result.credentials.superAdmin.password}`);
    }
    if (result.credentials.companyAccounts) {
      console.log(
        `[seed] Empresa demo (${result.company}) — contas criadas: ${result.credentials.companyAccounts.emails.join(", ")} / senha: ${result.credentials.companyAccounts.password}`
      );
    }
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
