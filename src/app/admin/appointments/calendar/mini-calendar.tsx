import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAY_SHORT, addDays, isSameDay, startOfMonth, startOfWeek, toISODate } from "./calendar-dates";
import type { DayCount } from "@/lib/data/appointments";

const MONTH_FORMAT = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Mini calendário do mês na lateral dos Agendamentos: seleção rápida de dia.
 * Clicar num dia leva a agenda principal pra aquela data (mantendo a visão —
 * Dia/Semana/Mês — e os filtros); as setas só trocam o mês exibido. Um ponto
 * embaixo do número marca os dias com agendamentos (amarelo se algum ainda
 * aguarda confirmação). Tudo em links — sem JavaScript no cliente.
 */
export function MiniCalendar({
  month,
  selected,
  today,
  counts,
  prevHref,
  nextHref,
  todayHref,
  buildDayHref,
}: {
  /** Qualquer data do mês exibido. */
  month: Date;
  selected: Date;
  today: Date;
  counts: Record<string, DayCount>;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  buildDayHref: (day: Date) => string;
}) {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shownMonth = first.getUTCMonth();

  return (
    <div className="rounded-2xl border bg-[var(--surface-subtle)] p-3" aria-label="Mini calendário">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground first-letter:uppercase">{MONTH_FORMAT.format(first)}</p>
        <div className="flex items-center gap-1">
          <Link href={prevHref} aria-label="Mês anterior" className="rounded-lg p-1.5 text-foreground-muted hover:bg-[var(--surface-subtle-hover)] hover:text-foreground">
            <ChevronUp className="h-4 w-4" />
          </Link>
          <Link href={nextHref} aria-label="Próximo mês" className="rounded-lg p-1.5 text-foreground-muted hover:bg-[var(--surface-subtle-hover)] hover:text-foreground">
            <ChevronDown className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-foreground-muted">
        {WEEKDAY_SHORT.map((label, i) => (
          <div key={i} className="pb-1">
            {label.slice(0, 1)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const key = toISODate(day);
          const info = counts[key];
          const outside = day.getUTCMonth() !== shownMonth;
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selected);
          return (
            <Link
              key={key}
              href={buildDayHref(day)}
              aria-label={`${day.getUTCDate()}/${day.getUTCMonth() + 1}${info ? `, ${info.count} agendamento(s)` : ""}`}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                outside ? "text-foreground-muted/50" : "text-foreground",
                isToday
                  ? "bg-secondary-dark font-semibold text-white"
                  : isSelected
                    ? "ring-2 ring-secondary"
                    : "hover:bg-[var(--surface-subtle-hover)]"
              )}
            >
              <span className="leading-none">{day.getUTCDate()}</span>
              <span
                className={cn(
                  "mt-1 h-1 w-1 rounded-full",
                  !info && "bg-transparent",
                  info && isToday && "bg-white",
                  info && !isToday && (info.hasPending ? "bg-warning" : "bg-secondary-light")
                )}
              />
            </Link>
          );
        })}
      </div>

      <Link href={todayHref} className="mt-2 block text-center text-xs text-secondary-light hover:underline">
        Ir para hoje
      </Link>
    </div>
  );
}
