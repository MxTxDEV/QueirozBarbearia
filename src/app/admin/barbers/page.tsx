import Link from "next/link";
import { Plus } from "lucide-react";
import { listBarbers } from "@/lib/data/barbers";
import { requireAdminContext } from "@/lib/require-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function BarbersPage() {
  const user = await requireAdminContext();
  const barbers = await listBarbers(user.companyId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Barbeiros</h1>
          <p className="text-sm text-foreground-muted">Gerencie a equipe, horários e serviços realizados.</p>
        </div>
        <Link href="/admin/barbers/new">
          <Button>
            <Plus className="h-4 w-4" /> Novo barbeiro
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {barbers.map((b) => (
          <Link key={b.id} href={`/admin/barbers/${b.id}`}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-secondary-light to-secondary-dark text-lg font-semibold text-white">
                    {b.name.slice(0, 1)}
                  </div>
                  <Badge variant={b.active ? "success" : "muted"}>{b.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                <div>
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="text-xs text-foreground-muted">{b.specialties.join(", ") || "Sem especialidades"}</p>
                </div>
                <p className="text-xs text-foreground-muted">
                  {b.workingHours.length} dia(s) de trabalho configurados · {b.services.length} serviço(s)
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
