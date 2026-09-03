import { createBarberAction } from "@/actions/barbers";
import { Card, CardContent } from "@/components/ui/card";
import { BarberForm } from "../barber-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function NewBarberPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Breadcrumb items={[{ label: "Barbeiros", href: "/admin/barbers" }, { label: "Novo" }]} />
      <h1 className="text-2xl font-semibold text-foreground">Novo barbeiro</h1>
      <Card>
        <CardContent>
          <BarberForm action={createBarberAction} />
        </CardContent>
      </Card>
    </div>
  );
}
