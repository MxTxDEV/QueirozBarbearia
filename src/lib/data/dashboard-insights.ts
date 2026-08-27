import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

/**
 * Camada de dados exclusiva do novo Dashboard. Isolada de
 * `data/dashboard.ts` (compartilhado com /admin/reports) e de
 * `data/financial.ts` — nenhuma query aqui é reutilizada por outro
 * módulo, e nenhuma regra de negócio é recalculada (preço, comissão,
 * disponibilidade de agenda): são apenas leituras/agregações sobre as
 * mesmas tabelas.
 */

export type DashboardPeriod = "today" | "7d" | "30d" | "month";

export const DASHBOARD_PERIOD_LABEL: Record<DashboardPeriod, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Este mês",
};

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Intervalo do período selecionado + o intervalo anterior de mesmo tamanho, para comparação. */
export function resolveDashboardRange(period: DashboardPeriod) {
  const today = dateOnlyUTC(new Date());
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + 1);

  if (period === "today") {
    const from = today;
    const prevFrom = new Date(today);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - 1);
    return { from, to, prevFrom, prevTo: today };
  }

  if (period === "7d") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 6);
    const prevFrom = new Date(from);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - 7);
    return { from, to, prevFrom, prevTo: from };
  }

  if (period === "30d") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 29);
    const prevFrom = new Date(from);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - 30);
    return { from, to, prevFrom, prevTo: from };
  }

  // month
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const daysElapsed = today.getUTCDate();
  const prevFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const prevTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, daysElapsed + 1));
  return { from, to, prevFrom, prevTo };
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

async function revenueForRange(from: Date, to: Date) {
  const agg = await prisma.financialTransaction.aggregate({
    where: { type: "INCOME", transactionDate: { gte: from, lt: to } },
    _sum: { amount: true },
  });
  return toNumber(agg._sum.amount);
}

export type DashboardOverview = {
  revenue: number;
  revenueChangePercent: number | null;
  appointmentsCount: number;
  completedCount: number;
  pendingCount: number;
  confirmedCount: number;
  cancelledCount: number;
  noShowCount: number;
  ticketMedio: number;
};

export async function getDashboardOverview(period: DashboardPeriod): Promise<DashboardOverview> {
  const { from, to, prevFrom, prevTo } = resolveDashboardRange(period);

  const [
    revenue,
    prevRevenue,
    appointmentsCount,
    completedCount,
    pendingCount,
    confirmedCount,
    cancelledCount,
    noShowCount,
  ] = await Promise.all([
    revenueForRange(from, to),
    revenueForRange(prevFrom, prevTo),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: "PENDING" } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: "CONFIRMED" } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: "CANCELLED" } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: from, lt: to }, status: "NO_SHOW" } }),
  ]);

  return {
    revenue,
    revenueChangePercent: percentChange(revenue, prevRevenue),
    appointmentsCount,
    completedCount,
    pendingCount,
    confirmedCount,
    cancelledCount,
    noShowCount,
    ticketMedio: completedCount > 0 ? revenue / completedCount : 0,
  };
}

export type RevenuePoint = { label: string; amount: number };

/** Série do faturamento no período — acumulado por hora em "hoje", por dia nos demais. */
export async function getRevenueTimeSeries(period: DashboardPeriod): Promise<RevenuePoint[]> {
  const { from, to } = resolveDashboardRange(period);
  const rows = await prisma.financialTransaction.findMany({
    where: { type: "INCOME", transactionDate: { gte: from, lt: to } },
    select: { transactionDate: true, amount: true },
  });

  if (period === "today") {
    const byHour = new Map<number, number>();
    for (const r of rows) {
      const h = r.transactionDate.getUTCHours();
      byHour.set(h, (byHour.get(h) ?? 0) + toNumber(r.amount));
    }
    let running = 0;
    const currentHour = new Date().getUTCHours();
    const points: RevenuePoint[] = [];
    for (let h = 0; h <= currentHour; h++) {
      running += byHour.get(h) ?? 0;
      points.push({ label: `${String(h).padStart(2, "0")}h`, amount: running });
    }
    return points;
  }

  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = r.transactionDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + toNumber(r.amount));
  }
  const points: RevenuePoint[] = [];
  for (let d = new Date(from); d < to; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const label = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    points.push({ label, amount: byDay.get(key) ?? 0 });
  }
  return points;
}

export type ServiceBreakdownItem = { name: string; revenue: number; count: number };

/** Receita e quantidade por serviço, no período — só considera atendimentos concluídos. */
export async function getServiceBreakdown(period: DashboardPeriod): Promise<ServiceBreakdownItem[]> {
  const { from, to } = resolveDashboardRange(period);
  const rows = await prisma.appointmentService.findMany({
    where: { appointment: { status: "COMPLETED", appointmentDate: { gte: from, lt: to } } },
    select: { serviceName: true, priceAtBooking: true },
  });

  const map = new Map<string, ServiceBreakdownItem>();
  for (const r of rows) {
    const cur = map.get(r.serviceName) ?? { name: r.serviceName, revenue: 0, count: 0 };
    cur.revenue += toNumber(r.priceAtBooking);
    cur.count += 1;
    map.set(r.serviceName, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Agenda completa de hoje (todos os status), para a visão do dia. */
export async function getTodayAgenda() {
  const today = dateOnlyUTC(new Date());
  return prisma.appointment.findMany({
    where: { appointmentDate: today },
    orderBy: { startTime: "asc" },
    include: { customer: true, barber: true, services: true },
  });
}

/** O próximo atendimento a partir de agora (pendente ou confirmado). */
export async function getNextAppointment() {
  return prisma.appointment.findFirst({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: { customer: true, barber: true, services: true },
  });
}

export type BarberOccupancy = {
  id: string;
  name: string;
  percent: number;
  working: boolean;
};

/** Ocupação de hoje: minutos de agenda ocupados vs. minutos disponíveis no expediente. */
export async function getOccupancyToday(): Promise<{ overallPercent: number; perBarber: BarberOccupancy[] }> {
  const today = dateOnlyUTC(new Date());
  const weekday = today.getUTCDay();
  const barbers = await prisma.barber.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const perBarberRaw = await Promise.all(
    barbers.map(async (barber) => {
      const [workingHour, timeOff, bookedAgg] = await Promise.all([
        prisma.barberWorkingHour.findUnique({ where: { barberId_weekday: { barberId: barber.id, weekday } } }),
        prisma.barberTimeOff.findFirst({ where: { barberId: barber.id, startDate: { lte: today }, endDate: { gte: today } } }),
        prisma.appointment.aggregate({
          where: { barberId: barber.id, appointmentDate: today, status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } },
          _sum: { totalDurationMin: true },
        }),
      ]);

      const working = !!workingHour && !timeOff;
      let availableMinutes = 0;
      if (working && workingHour) {
        let total = toMinutes(workingHour.endTime) - toMinutes(workingHour.startTime);
        if (workingHour.breakStart && workingHour.breakEnd) {
          total -= toMinutes(workingHour.breakEnd) - toMinutes(workingHour.breakStart);
        }
        availableMinutes = Math.max(0, total);
      }
      const bookedMinutes = bookedAgg._sum.totalDurationMin ?? 0;

      return { id: barber.id, name: barber.name, working, availableMinutes, bookedMinutes };
    })
  );

  const workingBarbers = perBarberRaw.filter((b) => b.working);
  const totalAvailable = workingBarbers.reduce((s, b) => s + b.availableMinutes, 0);
  const totalBooked = workingBarbers.reduce((s, b) => s + b.bookedMinutes, 0);

  return {
    overallPercent: totalAvailable > 0 ? Math.min(100, Math.round((totalBooked / totalAvailable) * 100)) : 0,
    perBarber: perBarberRaw.map((b) => ({
      id: b.id,
      name: b.name,
      working: b.working,
      percent: b.availableMinutes > 0 ? Math.min(100, Math.round((b.bookedMinutes / b.availableMinutes) * 100)) : 0,
    })),
  };
}

export type BarberPerformanceItem = {
  id: string;
  name: string;
  revenue: number;
  completed: number;
  cancelled: number;
  avgTicket: number;
};

/** Desempenho de cada barbeiro ativo no período (faturamento, atendimentos, ticket médio). */
export async function getBarberPerformance(period: DashboardPeriod): Promise<BarberPerformanceItem[]> {
  const { from, to } = resolveDashboardRange(period);
  const barbers = await prisma.barber.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  const items = await Promise.all(
    barbers.map(async (barber) => {
      const [completed, cancelled, incomeAgg] = await Promise.all([
        prisma.appointment.count({ where: { barberId: barber.id, appointmentDate: { gte: from, lt: to }, status: "COMPLETED" } }),
        prisma.appointment.count({ where: { barberId: barber.id, appointmentDate: { gte: from, lt: to }, status: "CANCELLED" } }),
        prisma.financialTransaction.aggregate({
          where: { type: "INCOME", transactionDate: { gte: from, lt: to }, appointment: { barberId: barber.id } },
          _sum: { amount: true },
        }),
      ]);
      const revenue = toNumber(incomeAgg._sum.amount);
      return { id: barber.id, name: barber.name, revenue, completed, cancelled, avgTicket: completed > 0 ? revenue / completed : 0 };
    })
  );

  return items.sort((a, b) => b.revenue - a.revenue);
}

export type CustomerInsights = {
  totalCustomers: number;
  newCustomers: number;
  newCustomersChangePercent: number | null;
  servedCount: number;
  returningCount: number;
  returningPercent: number | null;
};

/** Base de clientes: total, novos no período, e quantos atendidos no período já eram clientes antigos. */
export async function getCustomerInsights(period: DashboardPeriod): Promise<CustomerInsights> {
  const { from, to, prevFrom, prevTo } = resolveDashboardRange(period);

  const [totalCustomers, newCustomers, prevNewCustomers, servedDistinct] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.customer.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
    prisma.appointment.findMany({
      where: { status: "COMPLETED", appointmentDate: { gte: from, lt: to } },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
  ]);

  const servedIds = servedDistinct.map((a) => a.customerId);
  let returningCount = 0;
  if (servedIds.length > 0) {
    const priorVisits = await prisma.appointment.findMany({
      where: { customerId: { in: servedIds }, status: "COMPLETED", appointmentDate: { lt: from } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    returningCount = priorVisits.length;
  }

  return {
    totalCustomers,
    newCustomers,
    newCustomersChangePercent: percentChange(newCustomers, prevNewCustomers),
    servedCount: servedIds.length,
    returningCount,
    returningPercent: servedIds.length > 0 ? Math.round((returningCount / servedIds.length) * 100) : null,
  };
}

export type ActivityItem = {
  id: string;
  kind: "payment" | "created" | "completed" | "customer";
  title: string;
  subtitle: string;
  at: string;
  amount?: number;
};

/** Timeline de atividade recente, combinando pagamentos, agendamentos e novos clientes. */
export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const [payments, created, completed, customers] = await Promise.all([
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { customer: true } }),
    prisma.appointment.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { customer: true } }),
    prisma.appointment.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: limit,
      include: { customer: true },
    }),
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
  ]);

  const items: ActivityItem[] = [
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      kind: "payment" as const,
      title: "Pagamento recebido",
      subtitle: p.customer.fullName,
      at: p.createdAt.toISOString(),
      amount: toNumber(p.amount),
    })),
    ...created.map((a) => ({
      id: `apt-${a.id}`,
      kind: "created" as const,
      title: "Novo agendamento",
      subtitle: a.customer.fullName,
      at: a.createdAt.toISOString(),
    })),
    ...completed.map((a) => ({
      id: `cmp-${a.id}`,
      kind: "completed" as const,
      title: "Atendimento concluído",
      subtitle: a.customer.fullName,
      at: (a.completedAt as Date).toISOString(),
    })),
    ...customers.map((c) => ({
      id: `cus-${c.id}`,
      kind: "customer" as const,
      title: "Novo cliente",
      subtitle: c.fullName,
      at: c.createdAt.toISOString(),
    })),
  ];

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}
