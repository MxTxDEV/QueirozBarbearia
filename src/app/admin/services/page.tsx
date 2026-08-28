import Link from "next/link";
import { listServices } from "@/lib/data/services";
import { createServiceAction, toggleServiceActiveAction } from "@/actions/services";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServiceForm } from "./service-form";
import { ToggleActiveButton } from "./toggle-active-button";
import { requireAdminContext } from "@/lib/require-admin";

export default async function ServicesPage() {
  const user = await requireAdminContext();
  const services = await listServices(user.companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Serviços</h1>
        <p className="text-sm text-foreground-muted">Catálogo de serviços, preços e durações.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                  <TableCell className="text-foreground-muted">{formatCurrency(s.price.toString())}</TableCell>
                  <TableCell className="text-foreground-muted">{formatDuration(s.durationMinutes)}</TableCell>
                  <TableCell>
                    <Badge variant={s.active ? "success" : "muted"}>{s.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/services/${s.id}/edit`} className="text-sm text-secondary-light hover:underline">
                      Editar
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ToggleActiveButton id={s.id} active={s.active} action={toggleServiceActiveAction} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novo serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceForm action={createServiceAction} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
