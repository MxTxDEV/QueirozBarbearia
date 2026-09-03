import Link from "next/link";
import { cn } from "@/lib/utils";
import { DASHBOARD_PERIOD_LABEL, type DashboardPeriod } from "@/lib/data/dashboard-insights";

const PERIODS: DashboardPeriod[] = ["today", "7d", "30d", "month"];

/** Seletor de período — navegação por Link (sem JS), mesma técnica já usada no filtro de /admin/appointments. */
export function PeriodSelector({ current }: { current: DashboardPeriod }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`/admin/dashboard?period=${p}`}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
            current === p ? "bg-secondary-dark text-white shadow-[0_2px_12px_rgba(14,165,233,0.4)]" : "text-foreground-muted hover:text-foreground"
          )}
        >
          {DASHBOARD_PERIOD_LABEL[p]}
        </Link>
      ))}
    </div>
  );
}
