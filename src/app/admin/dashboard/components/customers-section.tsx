import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CustomerInsights } from "@/lib/data/dashboard-insights";

export function CustomersSection({ insights, ticketMedio }: { insights: CustomerInsights; ticketMedio: number }) {
  const change = insights.newCustomersChangePercent;

  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Clientes</p>
      <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{insights.totalCustomers}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">cadastrados</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{insights.newCustomers}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground-muted">
            novos no período
            {change !== null && (
              <span className={"inline-flex items-center " + (change >= 0 ? "text-success" : "text-danger")}>
                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change).toFixed(0)}%
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {insights.returningPercent !== null ? `${insights.returningPercent}%` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">retornaram no período</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{formatCurrency(ticketMedio)}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">ticket médio</p>
        </div>
      </div>
    </div>
  );
}
