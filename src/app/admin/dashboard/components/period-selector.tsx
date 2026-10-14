import Link from "next/link";
import { cn } from "@/lib/utils";
import { DASHBOARD_PERIOD_LABEL, type DashboardPeriod } from "@/lib/data/dashboard-insights";

const PERIODS: DashboardPeriod[] = ["today", "7d", "30d", "month"];

/** Seletor de período — navegação por Link (sem JS), mesma técnica já usada no filtro de /admin/appointments. */
export function PeriodSelector({ current }: { current: DashboardPeriod }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-[var(--surface-subtle)] p-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`/admin/dashboard?period=${p}`}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-all sm:px-3.5 sm:text-sm",
            current === p ? "seg-active" : "text-foreground-muted hover:text-foreground"
          )}
        >
          {DASHBOARD_PERIOD_LABEL[p]}
        </Link>
      ))}
    </div>
  );
}
