import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import { ChangePasswordForm } from "./change-password-form";
import { BookingLinkSection } from "./booking-link-section";
import { CoverImageForm } from "./cover-image-form";

export default async function SettingsPage() {
  const user = await requireAdminContext();
  const [systemNameSetting, company] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { companyId_key: { companyId: user.companyId, key: "system_name" } } }),
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { logoUrl: true, coverImageUrl: true, slug: true, onlineBookingEnabled: true },
    }),
  ]);
  const currentLogoUrl = company?.logoUrl ?? null;
  const currentCoverUrl = company?.coverImageUrl ?? null;
  // Só preenche o campo de URL externa se o valor atual for mesmo uma URL
  // absoluta (https://...) — nunca um caminho interno (upload nosso, ou o
  // arquivo estático herdado da migração antiga), senão o navegador recusa
  // o submit por não ser uma URL válida no input type="url".
  const externalLogoUrl = currentLogoUrl && /^https:\/\//.test(currentLogoUrl) ? currentLogoUrl : "";
  const externalCoverUrl = currentCoverUrl && /^https:\/\//.test(currentCoverUrl) ? currentCoverUrl : "";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>

      {user.role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>Identidade do sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm
              systemName={systemNameSetting?.value ?? "Barber Pro"}
              currentLogoUrl={currentLogoUrl}
              externalLogoUrl={externalLogoUrl}
            />
          </CardContent>
        </Card>
      )}

      {user.role === "ADMIN" && company && (
        <Card>
          <CardHeader>
            <CardTitle>Link de agendamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <CoverImageForm currentCoverUrl={currentCoverUrl} externalCoverUrl={externalCoverUrl} />
            <div className="border-t pt-6">
              <BookingLinkSection slug={company.slug} onlineBookingEnabled={company.onlineBookingEnabled} />
            </div>
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
