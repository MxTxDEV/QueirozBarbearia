"use client";

import { formatCurrency } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { ServiceDonut } from "./service-donut";
import { useChartTheme } from "./chart-theme";
import type { RevenuePoint, ServiceBreakdownItem } from "@/lib/data/dashboard-insights";

export function RevenueSection({
  revenue,
  series,
  services,
}: {
  revenue: number;
  series: RevenuePoint[];
  services: ServiceBreakdownItem[];
}) {
  const chart = useChartTheme();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="glass min-w-0 rounded-3xl p-6 lg:col-span-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Evolução do faturamento</p>
          <p className="text-lg font-semibold text-foreground">{formatCurrency(revenue)}</p>
        </div>
        <div className="mt-4">
          {series.some((p) => p.amount > 0) ? (
            <RevenueChart data={series} />
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Receita por serviço</p>
        {services.length === 0 ? (
          <p className="mt-8 text-center text-sm text-foreground-muted">
            Ainda não há atendimentos concluídos com pagamento neste período.
          </p>
        ) : (
          <>
            <ServiceDonut data={services} />
            <ul className="mt-2 space-y-2">
              {services.slice(0, 5).map((s, i) => (
                <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-foreground-muted">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: chart.categorical[i % chart.categorical.length] }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-foreground">{formatCurrency(s.revenue)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-foreground-muted">
      Sem faturamento registrado neste período.
    </div>
  );
}
