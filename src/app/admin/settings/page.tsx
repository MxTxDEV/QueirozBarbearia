import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import { ChangePasswordForm } from "./change-password-form";

export default async function SettingsPage() {
  const user = await requireAdminContext();
  const systemNameSetting = await prisma.systemSetting.findUnique({
    where: { companyId_key: { companyId: user.companyId, key: "system_name" } },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>

      {user.role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>Identidade do sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm systemName={systemNameSetting?.value ?? "Barber Pro"} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sua conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-foreground">{user.name}</p>
          <p className="text-foreground-muted">{user.email}</p>
          <p className="text-foreground-muted">{user.role === "ADMIN" ? "Administrador" : "Barbeiro"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
