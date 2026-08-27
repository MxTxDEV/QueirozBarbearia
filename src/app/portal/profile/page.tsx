import { requireCustomerContext } from "@/lib/require-customer";
import { formatWhatsappDisplay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export default async function PortalProfilePage() {
  const customer = await requireCustomerContext();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Meu perfil</h1>
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp cadastrado: {formatWhatsappDisplay(customer.whatsapp)}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              fullName: customer.fullName,
              email: customer.email ?? undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
