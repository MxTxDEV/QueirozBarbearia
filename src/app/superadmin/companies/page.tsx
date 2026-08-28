import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { listCompanies } from "@/lib/data/superadmin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativa", SUSPENDED: "Suspensa", BLOCKED: "Bloqueada" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BLOCKED: "danger",
};

export default async function SuperAdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const companies = await listCompanies(q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Empresas</h1>
          <p className="text-sm text-foreground-muted">{companies.length} empresa(s) cadastradas</p>
        </div>
        <Link href="/superadmin/companies/new">
          <Button>
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        </Link>
      </div>

      <form className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, slug ou e-mail" className="pl-9" />
      </form>

      <Card variant="solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Agendamentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-foreground-muted">/{c.slug}</p>
                </TableCell>
                <TableCell className="text-foreground-muted">{c._count.users}</TableCell>
                <TableCell className="text-foreground-muted">{c._count.customers}</TableCell>
                <TableCell className="text-foreground-muted">{c._count.appointments}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/superadmin/companies/${c.id}`} className="text-sm text-secondary-light hover:underline">
                    Ver detalhes
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-foreground-muted">
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
