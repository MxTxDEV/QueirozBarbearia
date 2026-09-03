import { notFound } from "next/navigation";
import { getCompanyDetail } from "@/lib/data/superadmin";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyForm } from "./company-form";
import { CompanyStatusActions } from "./company-status-actions";
import { NewUserForm } from "./new-user-form";
import { UserActiveToggle } from "./user-active-toggle";
import { ImpersonateButton } from "./impersonate-button";
import { Breadcrumb } from "@/components/layout/breadcrumb";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativa", SUSPENDED: "Suspensa", BLOCKED: "Bloqueada" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BLOCKED: "danger",
};
const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", BARBER: "Barbeiro", SUPERADMIN: "Super Admin" };

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCompanyDetail(id);
  if (!result) notFound();
  const { company, totalRevenue } = result;
  const primaryAdmin = company.users.find((u) => u.role === "ADMIN" && u.active);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Empresas", href: "/superadmin/companies" }, { label: company.name }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{company.name}</h1>
          <p className="text-sm text-foreground-muted">/{company.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[company.status]}>{STATUS_LABEL[company.status]}</Badge>
          {primaryAdmin && (
            <ImpersonateButton userId={primaryAdmin.id} active={primaryAdmin.active} label="Entrar como admin" variant="secondary" />
          )}
        </div>
      </div>

      <CompanyStatusActions companyId={company.id} status={company.status} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{company.users.length}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Barbeiros</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{company._count.barbers}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{company._count.customers}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className="text-success">{formatCurrency(totalRevenue)}</CardValue>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados da empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyForm
              companyId={company.id}
              defaults={{
                name: company.name,
                whatsapp: company.whatsapp ?? undefined,
                email: company.email ?? undefined,
                phone: company.phone ?? undefined,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adicionar usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <NewUserForm companyId={company.id} />
          </CardContent>
        </Card>
      </div>

      <Card variant="solid">
        <CardHeader>
          <CardTitle>Usuários da empresa</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {company.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                <TableCell className="text-foreground-muted">{u.email}</TableCell>
                <TableCell className="text-foreground-muted">{ROLE_LABEL[u.role]}</TableCell>
                <TableCell className="text-foreground-muted">{formatDate(u.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? "success" : "muted"}>{u.active ? "Ativo" : "Bloqueado"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {u.role !== "SUPERADMIN" && <ImpersonateButton userId={u.id} active={u.active} />}
                    <UserActiveToggle userId={u.id} active={u.active} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {company.users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-foreground-muted">
                  Nenhum usuário cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
