import Link from "next/link";
import { cn } from "@/lib/utils";
import { WEEKDAY_SHORT, isSameDay } from "./calendar-dates";

export type MonthDayCount = { day: Date; count: number; hasPending: boolean };

/**
 * Visão de Mês no celular: grade compacta (like Google/Apple Calendar),
 * bem diferente do carrossel de dia/semana — um mês inteiro em carrosséis
 * verticais seria dezenas de seções pra rolar, o oposto do que uma visão
 * mensal deveria dar (um panorama rápido). Cada dia é só um número + um
 * indicador; tocar num dia leva direto pra visão de Dia daquela data,
 * reaproveitando o carrossel que já existe em vez de duplicar a UI de
 * agendamento aqui dentro.
 */
export function MobileMonthGrid({
  days,
  month,
  today,
  counts,
  buildHref,
}: {
  days: Date[];
  month: number;
  today: Date;
  counts: MonthDayCount[];
  buildHref: (day: Date) => string;
}) {
  const countMap = new Map(counts.map((c) => [c.day.toISOString(), c]));

  return (
    <div className="space-y-2 md:hidden">
      <div className="grid grid-cols-7 text-center text-[11px] uppercase tracking-wide text-foreground-muted">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label}>{label.slice(0, 1)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const outsideMonth = day.getUTCMonth() !== month;
          const isToday = isSameDay(day, today);
          const info = countMap.get(day.toISOString());
          const hasItems = !!info && info.count > 0;

          return (
            <Link
              key={day.toISOString()}
              href={buildHref(day)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors",
                outsideMonth ? "text-foreground-muted/40" : "text-foreground",
                isToday ? "bg-secondary-dark font-semibold text-white" : "hover:bg-[var(--surface-subtle-hover)]"
              )}
            >
              <span>{day.getUTCDate()}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  !hasItems && "bg-transparent",
                  hasItems && isToday && "bg-white",
                  hasItems && !isToday && info!.hasPending && "bg-warning",
                  hasItems && !isToday && !info!.hasPending && "bg-secondary-light"
                )}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
