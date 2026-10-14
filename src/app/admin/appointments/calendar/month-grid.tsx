import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BreakChip } from "./break-chip";
import type { BreakInfo } from "./break-types";
import { AppointmentBlock, type BlockData } from "./appointment-block";
import { WEEKDAY_SHORT, isSameDay } from "./calendar-dates";
import { AppointmentDropZone } from "./appointment-dnd";
import { MARK_COLOR, dominantKind, markReason, type MarkKind } from "@/lib/day-marks";
import type { DayMarkRow } from "@/lib/data/day-marks";

export type MonthAppointment = {
  block: BlockData;
  actions?: React.ReactNode;
  day: Date;
};

const MAX_VISIBLE_PER_DAY = 3;

/** Grade mensal: semanas em linhas, com os agendamentos resumidos em cada dia. */
export function MonthGrid({
  days,
  appointments,
  month,
  today,
  buildNewHref,
  closedDays,
  breakInfo,
  marks = {},
}: {
  days: Date[];
  appointments: MonthAppointment[];
  month: number;
  today: Date;
  /** Link do botão "+" de cada dia (some em dias passados). */
  buildNewHref?: (day: Date) => string;
  /** Dias (YYYY-MM-DD) em que nenhum barbeiro atende — ficam trancados. */
  closedDays?: Set<string>;
  /** Por dia (YYYY-MM-DD): intervalo editável — só quando o mês mostra UM barbeiro. */
  breakInfo?: Record<string, BreakInfo | undefined>;
  /** Dias marcados (feriado/folga/fora de expediente) por YYYY-MM-DD. */
  marks?: Record<string, DayMarkRow[]>;
}) {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAY_SHORT.map((label) => (
            <div key={label} className="px-2 pb-2 text-center text-[11px] uppercase tracking-wide text-foreground-muted">
              {label}
            </div>
          ))}
        </div>

        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const dayAppointments = appointments.filter((a) => isSameDay(a.day, day));
                const outsideMonth = day.getUTCMonth() !== month;
                const isToday = isSameDay(day, today);
                const hidden = dayAppointments.length - MAX_VISIBLE_PER_DAY;
                const closed = closedDays?.has(day.toISOString().slice(0, 10)) ?? false;
                const dayMarks = marks[day.toISOString().slice(0, 10)] ?? [];
                const markKind = dominantKind(dayMarks);

                return (
                  <AppointmentDropZone
                    key={day.toISOString()}
                    mode="day"
                    date={day.toISOString().slice(0, 10)}
                    className={cn(
                      "relative min-h-[104px] border-b border-l p-1.5",
                      outsideMonth && "opacity-40",
                      markKind && MARK_COLOR[markKind].top
                    )}
                    style={
                      closed
                        ? {
                            backgroundColor: "var(--surface-subtle)",
                            backgroundImage: "repeating-linear-gradient(135deg, var(--border-glass) 0 1px, transparent 1px 9px)",
                          }
                        : undefined
                    }
                    title={dayMarks.length > 0 ? dayMarks.map((m) => markReason(m)).join(" · ") : closed ? "Fechado — ninguém atende neste dia" : undefined}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday ? "bg-secondary-dark text-white" : "text-foreground-muted"
                        )}
                      >
                        {day.getUTCDate()}
                      </p>
                      {closed && (
                        <span className="flex h-6 w-6 items-center justify-center text-foreground-muted/70" aria-label="Fechado">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {!closed && buildNewHref && day.getTime() >= today.getTime() && (
                        <Link
                          href={buildNewHref(day)}
                          aria-label={`Novo agendamento em ${day.getUTCDate()}/${day.getUTCMonth() + 1}`}
                          title="Novo agendamento neste dia"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-secondary-light opacity-40 transition hover:bg-secondary/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayMarks.map((m) => (
                        <p
                          key={`${m.kind}-${m.barberId ?? "all"}`}
                          className={cn("truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium", MARK_COLOR[m.kind as MarkKind]?.chip)}
                          title={markReason(m) + (m.barberName ? ` (só ${m.barberName})` : "")}
                        >
                          {markReason(m)}
                          {m.barberName ? ` · ${m.barberName}` : ""}
                        </p>
                      ))}
                      {!closed && breakInfo?.[day.toISOString().slice(0, 10)] && (
                        <BreakChip info={breakInfo[day.toISOString().slice(0, 10)]!} />
                      )}
                      {dayAppointments.slice(0, MAX_VISIBLE_PER_DAY).map((appt) => (
                        <AppointmentBlock key={appt.block.id} data={appt.block} actions={appt.actions} compact />
                      ))}
                      {hidden > 0 && (
                        <p className="px-1 text-[10px] text-foreground-muted">+{hidden} outro(s)</p>
                      )}
                    </div>
                  </AppointmentDropZone>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
