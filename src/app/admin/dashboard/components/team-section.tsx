import { formatCurrency } from "@/lib/utils";
import type { BarberOccupancy, BarberPerformanceItem } from "@/lib/data/dashboard-insights";

export function TeamSection({
  overallPercent,
  occupancy,
  performance,
}: {
  overallPercent: number;
  occupancy: BarberOccupancy[];
  performance: BarberPerformanceItem[];
}) {
  const workingBarbers = occupancy.filter((b) => b.working);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Ocupação hoje</p>
        <p className="mt-2 text-5xl font-semibold tracking-tight text-foreground">{overallPercent}%</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary to-secondary-light transition-all duration-[var(--duration-base)] motion-reduce:transition-none"
            style={{ width: `${overallPercent}%` }}
          />
        </div>

        {workingBarbers.length > 0 && (
          <div className="mt-6 space-y-3">
            {workingBarbers.map((b) => (
              <div key={b.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">{b.name}</span>
                  <span className="font-medium text-foreground">{b.percent}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div
                    className="h-full rounded-full bg-secondary-light/80 transition-all duration-[var(--duration-base)] motion-reduce:transition-none"
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass min-w-0 rounded-3xl p-6 lg:col-span-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Desempenho da equipe</p>
        {performance.length === 0 ? (
          <p className="mt-8 text-center text-sm text-foreground-muted">Nenhum barbeiro ativo cadastrado.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {performance.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-white/10 p-4 transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <p className="font-medium text-foreground">{b.name}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{formatCurrency(b.revenue)}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {b.completed} atendimento(s) · ticket {formatCurrency(b.avgTicket)}
                </p>
                {b.cancelled > 0 && <p className="mt-0.5 text-xs text-foreground-muted">{b.cancelled} cancelamento(s)</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
