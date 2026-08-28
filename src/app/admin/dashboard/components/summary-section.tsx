import { formatCurrency } from "@/lib/utils";
import { DASHBOARD_PERIOD_LABEL, type DashboardPeriod } from "@/lib/data/dashboard-insights";

export function SummarySection({
  period,
  revenue,
  appointmentsCount,
  totalCustomers,
  ticketMedio,
  occupancyPercent,
  newCustomers,
}: {
  period: DashboardPeriod;
  revenue: number;
  appointmentsCount: number;
  totalCustomers: number;
  ticketMedio: number;
  occupancyPercent: number;
  newCustomers: number;
}) {
  const items = [
    { label: "Faturamento", value: formatCurrency(revenue) },
    { label: "Atendimentos", value: String(appointmentsCount) },
    { label: "Clientes cadastrados", value: String(totalCustomers) },
    { label: "Ticket médio", value: formatCurrency(ticketMedio) },
    { label: "Ocupação", value: `${occupancyPercent}%` },
    { label: "Novos clientes", value: String(newCustomers) },
  ];

  return (
    <div className="glass-strong rounded-[2rem] p-8 text-center sm:p-10">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">
        Visão geral — {DASHBOARD_PERIOD_LABEL[period].toLowerCase()}
      </p>
      <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{item.value}</p>
            <p className="mt-1 text-xs text-foreground-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
