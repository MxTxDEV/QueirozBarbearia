import Link from "next/link";
import {
  CalendarPlus,
  UserPlus,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  AlertTriangle,
  CalendarCheck,
  Wallet,
  Scissors,
  Receipt,
  Target,
} from "lucide-react";
import {
  getBarberComparison,
  getDashboardAlerts,
  getMonthSummary,
  getTodaySummary,
  getUpcomingAppointments,
} from "@/lib/data/dashboard";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-foreground-muted">Resumo de hoje e do mês.</p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Hero: receita do mês */}
        <div className="glass glass-hover relative col-span-1 overflow-hidden rounded-2xl p-6 sm:col-span-2">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--secondary) 0%, transparent 70%)" }}
          />
          <div className="relative flex items-center justify-between">
            <p className="text-sm font-medium text-foreground-muted">Receita do mês</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/15 text-secondary-light">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="relative mt-2 text-4xl font-semibold tracking-tight text-foreground">{formatCurrency(month.income)}</p>
          <div className="relative mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-foreground-muted">
              Despesas: <span className="text-danger">{formatCurrency(month.expense)}</span>
            </span>
            <span className="text-foreground-muted">
              Lucro:{" "}
              <span className={month.profit >= 0 ? "text-accent-light" : "text-danger"}>{formatCurrency(month.profit)}</span>
            </span>
          </div>
          {month.targetValue && (
            <div className="relative mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-foreground-muted">
                <span>Meta mensal</span>
                <span>{month.goalPercent?.toFixed(0)}%</span>
              </div>
              <Progress value={month.goalPercent ?? 0} />
            </div>
          )}
        </div>

        <StatTile icon={CalendarCheck} label="Agendamentos hoje" value={String(today.appointmentsToday)}>
          {today.confirmedToday} confirmados · {today.pendingToday} pendentes
        </StatTile>

        <StatTile
          icon={Wallet}
          label="Saldo do dia"
          value={formatCurrency(today.balance)}
          valueClassName={today.balance >= 0 ? "text-accent-light" : "text-danger"}
        >
          Ticket médio: {formatCurrency(today.ticketMedio)}
        </StatTile>

        {/* Chart: comparativo de barbeiros */}
        <div className="glass glass-hover col-span-1 rounded-2xl p-5 sm:col-span-2 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-secondary-light" />
            <p className="text-sm font-medium text-foreground">Comparativo de barbeiros (mês)</p>
          </div>
          <BarberComparisonChart data={barberComparison.map((b) => ({ name: b.name, revenue: b.revenue }))} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {barberComparison.map((b) => (
              <div key={b.id} className="rounded-xl border p-3 text-sm">
                <p className="font-medium text-foreground">{b.name}</p>
                <p className="text-foreground-muted">
                  {b.completed} atendimentos · {formatCurrency(b.revenue)} · ticket {formatCurrency(b.avgTicket)}
                </p>
                <p className="text-xs text-foreground-muted">{b.cancelled} cancelamento(s)</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="glass col-span-1 rounded-2xl p-5">
          <p className="mb-3 text-sm font-medium text-foreground">Ações rápidas</p>
          <div className="grid gap-2">
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
          </div>
        </div>

        <StatTile icon={TrendingUp} label="Receita hoje" value={formatCurrency(today.income)} valueClassName="text-success" />
        <StatTile icon={TrendingDown} label="Despesas hoje" value={formatCurrency(today.expense)} valueClassName="text-danger" />
        <StatTile icon={Receipt} label="Despesas do mês" value={formatCurrency(month.expense)} valueClassName="text-danger" />
        <StatTile icon={Target} label="Lucro operacional" value={formatCurrency(month.profit)} valueClassName={month.profit >= 0 ? "text-accent-light" : "text-danger"} />

        {/* Próximos agendamentos */}
        <div className="glass glass-hover col-span-1 rounded-2xl p-5 sm:col-span-2 lg:col-span-3">
          <p className="mb-3 text-sm font-medium text-foreground">Próximos agendamentos</p>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-foreground-muted">Nenhum agendamento futuro.</p>}
            {upcoming.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between rounded-xl border p-3">
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
          </div>
        </div>

        {/* Alertas */}
        <div className="glass col-span-1 rounded-2xl p-5">
          <p className="mb-3 text-sm font-medium text-foreground">Alertas</p>
          <div className="space-y-2">
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
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  valueClassName,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass glass-hover col-span-1 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-secondary-light">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight text-foreground", valueClassName)}>{value}</p>
      {children && <p className="mt-1 text-xs text-foreground-muted">{children}</p>}
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
