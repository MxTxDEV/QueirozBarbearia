import { createBarberAction } from "@/actions/barbers";
import { Card, CardContent } from "@/components/ui/card";
import { BarberForm } from "../barber-form";

export default function NewBarberPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Novo barbeiro</h1>
      <Card>
        <CardContent>
          <BarberForm action={createBarberAction} />
        </CardContent>
      </Card>
    </div>
  );
}
