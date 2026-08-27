import { CalendarPlus, CheckCircle2, UserPlus, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ActivityItem } from "@/lib/data/dashboard-insights";

const ICON: Record<ActivityItem["kind"], React.ComponentType<{ className?: string }>> = {
  payment: Wallet,
  created: CalendarPlus,
  completed: CheckCircle2,
  customer: UserPlus,
};

const DOT_COLOR: Record<ActivityItem["kind"], string> = {
  payment: "bg-success",
  created: "bg-secondary",
  completed: "bg-accent-light",
  customer: "bg-secondary-light",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function ActivitySection({ items }: { items: ActivityItem[] }) {
  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Atividade recente</p>
      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground-muted">Nenhuma atividade registrada ainda.</p>
      ) : (
        <div className="mt-4 space-y-1">
          {items.map((item) => {
            const Icon = ICON[item.kind];
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl p-2.5 transition-colors hover:bg-[var(--surface-subtle)]">
                <span className={"mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full " + DOT_COLOR[item.kind] + "/15"}>
                  <Icon className="h-3.5 w-3.5 text-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-foreground-muted">
                    {item.amount !== undefined ? `${formatCurrency(item.amount)} — ${item.subtitle}` : item.subtitle}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-foreground-muted/70">{timeAgo(item.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
