import { Search } from "lucide-react";
import { requireSuperAdmin } from "@/lib/require-admin";
import { listSuperAdmins } from "@/lib/data/superadmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { NewSuperAdminForm } from "./new-superadmin-form";
import { SuperAdminRowActions } from "./superadmin-row-actions";

export default async function SuperAdminAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const currentUser = await requireSuperAdmin();
  const { q } = await searchParams;
  const admins = await listSuperAdmins(q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Super Admins</h1>
        <p className="text-sm text-foreground-muted">
          Contas com acesso total à plataforma — separadas dos usuários de cada empresa (ver &quot;Usuários&quot;).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova conta Super Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <NewSuperAdminForm />
        </CardContent>
      </Card>

      <form className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className="pl-9" />
      </form>

      <Card variant="solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium text-foreground">
                  {admin.name}
                  {admin.id === currentUser.id && <span className="ml-2 text-xs text-foreground-muted">(você)</span>}
                </TableCell>
                <TableCell className="text-foreground-muted">{admin.email}</TableCell>
                <TableCell>
                  <Badge variant={admin.active ? "success" : "muted"}>{admin.active ? "Ativo" : "Bloqueado"}</Badge>
                </TableCell>
                <TableCell className="text-foreground-muted">{formatDate(admin.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <SuperAdminRowActions userId={admin.id} active={admin.active} isSelf={admin.id === currentUser.id} />
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-foreground-muted">
                  Nenhum Super Admin encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
