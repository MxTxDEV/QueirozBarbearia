import { requireAdminContext } from "@/lib/require-admin";
import { getDashboardAlerts } from "@/lib/data/dashboard";
import {
  getBarberPerformance,
  getCustomerInsights,
  getDashboardOverview,
  getNextAppointment,
  getOccupancyToday,
  getRecentActivity,
  getRevenueTimeSeries,
  getServiceBreakdown,
  getTodayAgenda,
  type DashboardPeriod,
} from "@/lib/data/dashboard-insights";
import { AutoRefresh } from "@/components/auto-refresh";
import { Reveal } from "./components/reveal";
import { Hero } from "./components/hero";
import { RevenueSection } from "./components/revenue-section";
import { TodayAgenda } from "./components/today-agenda";
import { NextAppointment } from "./components/next-appointment";
import { TeamSection } from "./components/team-section";
import { CustomersSection } from "./components/customers-section";
import { AttentionSection } from "./components/attention-section";
import { ActivitySection } from "./components/activity-section";
import { SummarySection } from "./components/summary-section";

const VALID_PERIODS: DashboardPeriod[] = ["today", "7d", "30d", "month"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAdminContext();
  const sp = await searchParams;
  const period: DashboardPeriod = VALID_PERIODS.includes(sp.period as DashboardPeriod)
    ? (sp.period as DashboardPeriod)
    : "today";

  const [overview, series, services, agenda, next, occupancy, performance, customers, alertsRaw, activity] = await Promise.all([
    getDashboardOverview(period),
    getRevenueTimeSeries(period),
    getServiceBreakdown(period),
    getTodayAgenda(),
    getNextAppointment(),
    getOccupancyToday(),
    getBarberPerformance(period),
    getCustomerInsights(period),
    getDashboardAlerts(),
    getRecentActivity(8),
  ]);

  const alerts = [
    alertsRaw.pendingConfirmation > 0 && {
      text: `${alertsRaw.pendingConfirmation} agendamento(s) aguardando confirmação`,
      href: "/admin/appointments?status=PENDING",
    },
    overview.cancelledCount > 0 && { text: `${overview.cancelledCount} cancelamento(s) no período`, href: "/admin/appointments" },
    overview.noShowCount > 0 && { text: `${overview.noShowCount} falta(s) no período`, href: "/admin/appointments" },
    alertsRaw.overdueExpenses > 0 && { text: `${alertsRaw.overdueExpenses} despesa(s) vencida(s)`, href: "/admin/financial/expenses" },
    alertsRaw.goalsAtRiskCount > 0 && { text: `${alertsRaw.goalsAtRiskCount} meta(s) em risco`, href: "/admin/goals" },
    alertsRaw.unpaidCompleted > 0 && {
      text: `${alertsRaw.unpaidCompleted} atendimento(s) concluído(s) sem pagamento registrado`,
      href: "/admin/appointments?range=month",
    },
  ].filter((a): a is { text: string; href: string } => !!a);

  return (
    <div className="space-y-8 pb-4">
      <AutoRefresh />

      <Reveal>
        <Hero userName={user.name} period={period} overview={overview} occupancyPercent={occupancy.overallPercent} />
      </Reveal>

      <Reveal delayMs={60}>
        <RevenueSection revenue={overview.revenue} series={series} services={services} />
      </Reveal>

      <Reveal delayMs={60}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TodayAgenda appointments={agenda} />
          </div>
          <NextAppointment appointment={next} />
        </div>
      </Reveal>

      <Reveal delayMs={60}>
        <TeamSection overallPercent={occupancy.overallPercent} occupancy={occupancy.perBarber} performance={performance} />
      </Reveal>

      <Reveal delayMs={60}>
        <CustomersSection insights={customers} ticketMedio={overview.ticketMedio} />
      </Reveal>

      {alerts.length > 0 && (
        <Reveal delayMs={60}>
          <AttentionSection alerts={alerts} />
        </Reveal>
      )}

      <Reveal delayMs={60}>
        <ActivitySection items={activity} />
      </Reveal>

      <Reveal delayMs={60}>
        <SummarySection
          period={period}
          revenue={overview.revenue}
          appointmentsCount={overview.appointmentsCount}
          totalCustomers={customers.totalCustomers}
          ticketMedio={overview.ticketMedio}
          occupancyPercent={occupancy.overallPercent}
          newCustomers={customers.newCustomers}
        />
      </Reveal>
    </div>
  );
}
