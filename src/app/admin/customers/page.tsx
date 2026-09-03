import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { listCustomers } from "@/lib/data/customers";
import { formatWhatsappDisplay } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { requireAdminContext } from "@/lib/require-admin";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdminContext();
  const { q } = await searchParams;
  const customers = await listCustomers(user.companyId, q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-foreground-muted">{customers.length} clientes cadastrados</p>
        </div>
        <Link href="/admin/customers/new">
          <Button>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </Link>
      </div>

      <form className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou WhatsApp" className="pl-9" />
      </form>

      <Card variant="solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Agendamentos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.fullName}</TableCell>
                <TableCell className="text-foreground-muted">{formatWhatsappDisplay(c.whatsapp)}</TableCell>
                <TableCell className="text-foreground-muted">{c._count.appointments}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/customers/${c.id}`} className="text-sm text-secondary-light hover:underline">
                    Ver perfil
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  {q ? (
                    <EmptyState icon={Users} title="Nenhum cliente encontrado" description={`Nenhum resultado para "${q}".`} />
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="Nenhum cliente cadastrado"
                      description="Cadastre o primeiro cliente para começar a agendar horários."
                      action={
                        <Link href="/admin/customers/new">
                          <Button size="sm">
                            <Plus className="h-4 w-4" /> Novo cliente
                          </Button>
                        </Link>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
