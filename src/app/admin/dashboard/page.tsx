import Link from "next/link";
import { CalendarPlus, UserPlus, TrendingUp, TrendingDown, MessageCircle, AlertTriangle } from "lucide-react";
import {
  getBarberComparison,
  getDashboardAlerts,
  getMonthSummary,
  getTodaySummary,
  getUpcomingAppointments,
} from "@/lib/data/dashboard";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarberComparisonChart } from "@/components/charts/barber-comparison-chart";

export default async function DashboardPage() {
  const [today, month, barberComparison, upcoming, alerts] = await Promise.all([
    getTodaySummary(),
    getMonthSummary(),
    getBarberComparison(),
    getUpcomingAppointments(),
    getDashboardAlerts(),
  ]);

  const hasAlerts =
    alerts.pendingConfirmation > 0 || alerts.overdueExpenses > 0 || alerts.goalsAtRiskCount > 0 || alerts.unpaidCompleted > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-foreground-muted">Resumo de hoje e do mês.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">Resumo de hoje</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Agendamentos hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue>{today.appointmentsToday}</CardValue>
              <p className="mt-1 text-xs text-foreground-muted">
                {today.confirmedToday} confirmados · {today.pendingToday} pendentes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Receita recebida hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-success">{formatCurrency(today.income)}</CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Despesas hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-danger">{formatCurrency(today.expense)}</CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Saldo do dia</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className={today.balance >= 0 ? "text-accent-light" : "text-danger"}>
                {formatCurrency(today.balance)}
              </CardValue>
              <p className="mt-1 text-xs text-foreground-muted">Ticket médio: {formatCurrency(today.ticketMedio)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">Este mês</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Receita total</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-success">{formatCurrency(month.income)}</CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-danger">{formatCurrency(month.expense)}</CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lucro operacional</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className={month.profit >= 0 ? "text-accent-light" : "text-danger"}>
                {formatCurrency(month.profit)}
              </CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Meta mensal</CardTitle>
            </CardHeader>
            <CardContent>
              {month.targetValue ? (
                <>
                  <CardValue>{month.goalPercent?.toFixed(0)}%</CardValue>
                  <Progress value={month.goalPercent ?? 0} className="mt-2" />
                </>
              ) : (
                <p className="text-sm text-foreground-muted">Nenhuma meta ativa</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Comparativo de barbeiros (mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarberComparisonChart data={barberComparison.map((b) => ({ name: b.name, revenue: b.revenue }))} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {barberComparison.map((b) => (
                <div key={b.id} className="rounded-xl border border-white/10 p-3 text-sm">
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="text-foreground-muted">
                    {b.completed} atendimentos · {formatCurrency(b.revenue)} · ticket {formatCurrency(b.avgTicket)}
                  </p>
                  <p className="text-xs text-foreground-muted">{b.cancelled} cancelamento(s)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/admin/appointments/new">
              <Button className="w-full justify-start" variant="secondary">
                <CalendarPlus className="h-4 w-4" /> Novo agendamento
              </Button>
            </Link>
            <Link href="/admin/customers/new">
              <Button className="w-full justify-start" variant="secondary">
                <UserPlus className="h-4 w-4" /> Novo cliente
              </Button>
            </Link>
            <Link href="/admin/financial/income">
              <Button className="w-full justify-start" variant="secondary">
                <TrendingUp className="h-4 w-4" /> Nova receita
              </Button>
            </Link>
            <Link href="/admin/financial/expenses">
              <Button className="w-full justify-start" variant="secondary">
                <TrendingDown className="h-4 w-4" /> Nova despesa
              </Button>
            </Link>
            <Link href="/admin/customers">
              <Button className="w-full justify-start" variant="secondary">
                <MessageCircle className="h-4 w-4" /> Enviar mensagem
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximos agendamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-foreground-muted">Nenhum agendamento futuro.</p>}
            {upcoming.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(appt.appointmentDate)} às {formatTime(appt.startTime)} — {appt.customer.fullName}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {appt.barber.name} · {appt.services.map((s) => s.serviceName).join(", ")}
                  </p>
                </div>
                <Badge variant={APPOINTMENT_STATUS_VARIANT[appt.status]}>{APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!hasAlerts && <p className="text-sm text-foreground-muted">Tudo em dia por aqui.</p>}
            {alerts.pendingConfirmation > 0 && (
              <AlertRow text={`${alerts.pendingConfirmation} agendamento(s) aguardando confirmação`} href="/admin/appointments?status=PENDING" />
            )}
            {alerts.overdueExpenses > 0 && (
              <AlertRow text={`${alerts.overdueExpenses} despesa(s) vencida(s)`} href="/admin/financial/expenses" />
            )}
            {alerts.goalsAtRiskCount > 0 && <AlertRow text={`${alerts.goalsAtRiskCount} meta(s) em risco`} href="/admin/goals" />}
            {alerts.unpaidCompleted > 0 && (
              <AlertRow text={`${alerts.unpaidCompleted} atendimento(s) concluído(s) sem pagamento registrado`} href="/admin/appointments?range=month" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AlertRow({ text, href }: { text: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground hover:bg-warning/15"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      {text}
    </Link>
  );
}
