import Link from "next/link";
import { Search } from "lucide-react";
import { listAllUsers } from "@/lib/data/superadmin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", BARBER: "Barbeiro" };

export default async function SuperAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await listAllUsers(q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
        <p className="text-sm text-foreground-muted">{users.length} usuário(s) em todas as empresas</p>
      </div>

      <form className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className="pl-9" />
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                <TableCell className="text-foreground-muted">{u.email}</TableCell>
                <TableCell className="text-foreground-muted">
                  {u.company ? (
                    <Link href={`/superadmin/companies/${u.companyId}`} className="hover:underline">
                      {u.company.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-foreground-muted">{ROLE_LABEL[u.role] ?? u.role}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? "success" : "muted"}>{u.active ? "Ativo" : "Bloqueado"}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-foreground-muted">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
