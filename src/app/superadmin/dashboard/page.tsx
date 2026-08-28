import Link from "next/link";
import { Building2, Users, CalendarClock, Wallet, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { getPlatformOverview } from "@/lib/data/superadmin";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SuperAdminDashboardPage() {
  const overview = await getPlatformOverview();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Visão geral da plataforma</h1>
          <p className="text-sm text-foreground-muted">Métricas globais de todas as empresas cadastradas.</p>
        </div>
        <Link href="/superadmin/companies/new">
          <Button>Nova empresa</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <Building2 className="mr-1.5 inline h-4 w-4" /> Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{overview.totalCompanies}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <Users className="mr-1.5 inline h-4 w-4" /> Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{overview.totalUsers}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <CalendarClock className="mr-1.5 inline h-4 w-4" /> Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{overview.totalAppointments}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <Wallet className="mr-1.5 inline h-4 w-4" /> Faturamento total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className="text-success">{formatCurrency(overview.totalRevenue)}</CardValue>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-xl font-semibold text-foreground">{overview.activeCompanies}</p>
              <p className="text-xs text-foreground-muted">Empresas ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <PauseCircle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-xl font-semibold text-foreground">{overview.suspendedCompanies}</p>
              <p className="text-xs text-foreground-muted">Empresas suspensas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-danger" />
            <div>
              <p className="text-xl font-semibold text-foreground">{overview.blockedCompanies}</p>
              <p className="text-xs text-foreground-muted">Empresas bloqueadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Total de clientes na plataforma</p>
              <p className="text-xs text-foreground-muted">Somando todas as empresas</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">{overview.totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Gerenciar empresas</p>
              <p className="text-xs text-foreground-muted">Ver, editar, bloquear ou suspender</p>
            </div>
            <Link href="/superadmin/companies">
              <Button variant="secondary" size="sm">
                Ver todas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
