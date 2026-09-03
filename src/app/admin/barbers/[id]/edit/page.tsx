import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateBarberAction } from "@/actions/barbers";
import { Card, CardContent } from "@/components/ui/card";
import { BarberForm } from "../../barber-form";
import { requireAdminContext } from "@/lib/require-admin";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function EditBarberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const barber = await prisma.barber.findFirst({ where: { id, companyId: user.companyId } });
  if (!barber) notFound();

  const action = updateBarberAction.bind(null, id);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Breadcrumb
        items={[
          { label: "Barbeiros", href: "/admin/barbers" },
          { label: barber.name, href: `/admin/barbers/${id}` },
          { label: "Editar" },
        ]}
      />
      <h1 className="text-2xl font-semibold text-foreground">Editar barbeiro</h1>
      <Card>
        <CardContent>
          <BarberForm
            action={action}
            defaults={{
              name: barber.name,
              phone: barber.phone ?? undefined,
              photoUrl: barber.photoUrl ?? undefined,
              specialties: barber.specialties.join(", "),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
