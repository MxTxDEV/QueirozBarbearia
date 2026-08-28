import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CountUp } from "./count-up";
import { PeriodSelector } from "./period-selector";
import type { DashboardOverview, DashboardPeriod } from "@/lib/data/dashboard-insights";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function Hero({
  userName,
  period,
  overview,
  occupancyPercent,
}: {
  userName: string;
  period: DashboardPeriod;
  overview: DashboardOverview;
  occupancyPercent: number;
}) {
  const change = overview.revenueChangePercent;
  const firstName = userName.split(" ")[0];

  return (
    <div className="glass-strong relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-25 blur-[100px]"
        style={{ background: "radial-gradient(circle, var(--secondary) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full opacity-15 blur-[100px]"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground-muted">
              {greeting()}, {firstName}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">Como está sua barbearia agora</h1>
          </div>
          <PeriodSelector current={period} />
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Faturamento</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
            <CountUp value={overview.revenue} format="currency" />
          </p>
          {change !== null && (
            <div
              className={
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium " +
                (change >= 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger")
              }
            >
              {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(change).toFixed(1)}% vs. período anterior
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6 sm:grid-cols-4">
          <HeroStat label="Atendimentos" value={String(overview.appointmentsCount)} />
          <HeroStat label="Ocupação" value={`${occupancyPercent}%`} />
          <HeroStat label="Concluídos" value={String(overview.completedCount)} />
          <HeroStat label="Agendados" value={String(overview.pendingCount + overview.confirmedCount)} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">{label}</p>
    </div>
  );
}
