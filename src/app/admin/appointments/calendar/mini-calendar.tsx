import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAY_SHORT, addDays, isSameDay, startOfMonth, startOfWeek, toISODate } from "./calendar-dates";
import type { DayCount } from "@/lib/data/appointments";
import { MARK_COLOR, MARK_KINDS, MARK_LABEL, dominantKind, markReason, type MarkKind } from "@/lib/day-marks";
import type { DayMarkRow } from "@/lib/data/day-marks";

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
  marks = {},
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
  /** Dias marcados (feriado/folga/fora de expediente) por YYYY-MM-DD — pintam o dia. */
  marks?: Record<string, DayMarkRow[]>;
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
          const dayMarks = marks[key] ?? [];
          const markKind = dominantKind(dayMarks);
          const color = markKind ? MARK_COLOR[markKind] : null;
          const markTitle = dayMarks.map((m) => markReason(m) + (m.barberName ? ` (só ${m.barberName})` : "")).join(" · ");
          return (
            <Link
              key={key}
              href={buildDayHref(day)}
              aria-label={`${day.getUTCDate()}/${day.getUTCMonth() + 1}${info ? `, ${info.count} agendamento(s)` : ""}${markTitle ? `, ${markTitle}` : ""}`}
              title={markTitle || undefined}
              data-mark={markKind ?? undefined}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                outside ? "text-foreground-muted/50" : "text-foreground",
                isToday
                  ? cn("bg-secondary-dark font-semibold text-white", color && cn("ring-2", color.ring))
                  : isSelected
                    ? "ring-2 ring-secondary"
                    : color
                      ? cn(color.cell, "hover:brightness-125")
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

      <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted" aria-label="Legenda das cores">
        {MARK_KINDS.map((kind: MarkKind) => (
          <li key={kind} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", MARK_COLOR[kind].dot)} /> {MARK_LABEL[kind]}
          </li>
        ))}
      </ul>

      <Link href={todayHref} className="mt-2 block text-center text-xs text-secondary-light hover:underline">
        Ir para hoje
      </Link>
    </div>
  );
}
