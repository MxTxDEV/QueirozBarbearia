import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewCompanyUserForm } from "./new-company-user-form";
import { ToggleActiveButton } from "../services/toggle-active-button";
import { toggleCompanyUserActiveAction } from "@/actions/company-users";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", BARBER: "Barbeiro" };

export default async function CompanyUsersPage() {
  const admin = await requireAdminOnly();

  const [users, availableBarbers] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      include: { barber: { select: { name: true } } },
    }),
    prisma.barber.findMany({
      where: { companyId: admin.companyId, userId: null, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
        <p className="text-sm text-foreground-muted">Crie logins de administrador ou barbeiro para sua equipe.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <NewCompanyUserForm availableBarbers={availableBarbers} />
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Barbeiro vinculado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-foreground">{u.name}</TableCell>
                <TableCell className="text-foreground-muted">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "ADMIN" ? "accent" : "muted"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                </TableCell>
                <TableCell className="text-foreground-muted">{u.barber?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? "success" : "muted"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell>
                  {u.id !== admin.id && (
                    <ToggleActiveButton id={u.id} active={u.active} action={toggleCompanyUserActiveAction} />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-foreground-muted">
                  Nenhum usuário cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
