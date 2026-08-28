import { requireCustomerContext, isCustomerProfileIncomplete } from "@/lib/require-customer";
import { formatWhatsappDisplay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export default async function PortalProfilePage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const customer = await requireCustomerContext(slug);
  const incomplete = isCustomerProfileIncomplete(customer);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Meu perfil</h1>

      {incomplete && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="text-sm text-warning">
            Complete seu cadastro (nome, e-mail e data de nascimento) para continuar usando o portal.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp cadastrado: {formatWhatsappDisplay(customer.whatsapp)}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              fullName: customer.fullName,
              email: customer.email ?? undefined,
              birthDate: customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
