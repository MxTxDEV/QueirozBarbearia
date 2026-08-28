import { cn } from "@/lib/utils";
import { isSameDay, WEEKDAY_SHORT } from "./calendar-dates";
import type { BlockData } from "./appointment-block";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type AgendaItem = {
  block: BlockData;
  actions?: React.ReactNode;
  day: Date;
};

const STATUS_BADGE_VARIANT: Record<string, "warning" | "accent" | "success" | "danger" | "muted"> = {
  PENDING: "warning",
  CONFIRMED: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "muted",
};

/**
 * Alternativa em cards à grade de horários/mês — a grade exige rolagem
 * horizontal (colunas de dias/barbeiros lado a lado) e fica ilegível na
 * largura de um celular. Mostrada só em telas pequenas (o grid continua
 * sendo a visão em telas maiores, onde faz sentido); mesmos dados e mesmas
 * ações, só o layout muda.
 */
export function MobileAgenda({
  days,
  today,
  items,
  skipEmptyDays = false,
}: {
  days: Date[];
  today: Date;
  items: AgendaItem[];
  skipEmptyDays?: boolean;
}) {
  return (
    <div className="space-y-5 md:hidden">
      {days.map((day) => {
        const dayItems = items
          .filter((i) => isSameDay(i.day, day))
          .sort((a, b) => a.block.timeLabel.localeCompare(b.block.timeLabel));

        if (skipEmptyDays && dayItems.length === 0) return null;

        const isToday = isSameDay(day, today);

        return (
          <div key={day.toISOString()}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isToday ? "bg-secondary text-white" : "bg-[var(--surface-subtle)] text-foreground-muted"
                )}
              >
                {day.getUTCDate()}
              </span>
              <p className="text-sm font-medium text-foreground first-letter:uppercase">
                {WEEKDAY_SHORT[day.getUTCDay()]}
              </p>
              <span className="text-xs text-foreground-muted">{dayItems.length} agendamento(s)</span>
            </div>

            {dayItems.length === 0 ? (
              <Card className="p-4 text-center text-sm text-foreground-muted">Nenhum agendamento</Card>
            ) : (
              <div className="space-y-2">
                {dayItems.map(({ block, actions }) => {
                  const cancelled = block.status === "CANCELLED" || block.status === "NO_SHOW";
                  return (
                    <Card key={block.id} className={cn("space-y-2 p-4", cancelled && "opacity-60")}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm font-semibold text-foreground", cancelled && "line-through")}>
                          {block.timeLabel}
                        </p>
                        <Badge variant={STATUS_BADGE_VARIANT[block.status] ?? "muted"}>{block.statusLabel}</Badge>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{block.customerName}</p>
                        <p className="text-xs text-foreground-muted">
                          {block.services} · {block.barberName}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-sm font-medium text-foreground">{block.price}</p>
                        {actions}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
