import { Banknote, CreditCard, Landmark, QrCode, Wallet } from "lucide-react";
import { getIncomeByPaymentMethod, type PeriodFilter } from "@/lib/data/financial";
import { formatCurrency } from "@/lib/utils";
import { formatPercent } from "@/lib/barber-financial-helpers";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: Landmark,
  PIX: QrCode,
  CASH: Banknote,
  OTHER: Wallet,
  NONE: Wallet,
};

/**
 * Entradas do período separadas por forma de pagamento: quanto entrou no débito, no crédito, no Pix e
 * no dinheiro, e quais clientes pagaram em cada uma (clique em "Ver clientes").
 */
export async function PaymentMethodsSection({ companyId, period }: { companyId: string; period: PeriodFilter }) {
  const { total, methods } = await getIncomeByPaymentMethod(companyId, period);

  return (
    <section className="space-y-3" aria-labelledby="payment-methods-title">
      <div>
        <p id="payment-methods-title" className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">
          Entradas por forma de pagamento
        </p>
        <p className="text-sm text-foreground-muted">Quanto entrou em cada forma de pagamento no período e quais clientes pagaram.</p>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {methods.map((m) => {
          const Icon = ICON[m.method] ?? Wallet;
          return (
            <div key={m.method} className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-secondary-light" aria-hidden /> {m.label}
                </span>
                <span className="text-xs text-foreground-muted">
                  {m.count} {m.count === 1 ? "pagamento" : "pagamentos"}
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatCurrency(m.total)}</p>
              <p className="text-xs text-foreground-muted">{formatPercent(m.share)} das entradas</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full rounded-full bg-success" style={{ width: `${m.share}%` }} />
              </div>

              {m.clients.length > 0 ? (
                <details className="group mt-4">
                  <summary className="cursor-pointer select-none text-sm text-secondary-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60">
                    Ver clientes ({m.clients.length})
                  </summary>
                  <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-sm">
                    {m.clients.map((c) => (
                      <li key={c.name} className="flex items-baseline justify-between gap-3 border-b border-[var(--border-glass)] pb-1.5 last:border-0">
                        <span className="min-w-0 truncate text-foreground">
                          {c.name}
                          {c.count > 1 && <span className="text-foreground-muted"> · {c.count}x</span>}
                        </span>
                        <span className="shrink-0 font-medium text-foreground">{formatCurrency(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="mt-4 text-sm text-foreground-muted">Nenhum pagamento neste período.</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-foreground-muted">
        Total das entradas: <span className="font-medium text-foreground">{formatCurrency(total)}</span> — a soma das formas acima.
      </p>
    </section>
  );
}
