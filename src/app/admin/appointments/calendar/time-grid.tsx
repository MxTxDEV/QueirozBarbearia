import { cn } from "@/lib/utils";
import { AppointmentBlock, type BlockData } from "./appointment-block";
import { WEEKDAY_SHORT, isSameDay, minutesFromMidnight } from "./calendar-dates";
import { QuickAddSlot } from "./quick-add-slot";
import { ClosedOverlay } from "./closed-overlay";
import { DraggableBreak } from "./draggable-break";
import type { BreakInfo } from "./break-types";
import { minutesToHHMM, type ClosedSegment } from "@/lib/quick-slots";

const HOUR_HEIGHT = 80; // px por hora — define a escala vertical da grade

export type GridAppointment = {
  block: BlockData;
  actions?: React.ReactNode;
  startTime: Date;
  endTime: Date;
  day: Date;
};

export type PositionedAppointment = GridAppointment & { lane: number; lanes: number };

/**
 * Distribui em colunas lado a lado os agendamentos que se sobrepõem no
 * tempo — barbeiros diferentes atendem no mesmo horário, e sem isso os
 * blocos se empilhariam um sobre o outro, ilegíveis.
 *
 * Agrupa os que colidem em "clusters" e, dentro de cada um, encaixa cada
 * agendamento na primeira coluna livre. A largura é dividida pelo número
 * de colunas que aquele cluster precisou.
 */
export function assignLanes(items: GridAppointment[]): PositionedAppointment[] {
  const sorted = [...items].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime() || a.endTime.getTime() - b.endTime.getTime()
  );

  const positioned: PositionedAppointment[] = [];
  let cluster: (GridAppointment & { lane: number })[] = [];
  let clusterEnd = 0;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneCount = Math.max(...cluster.map((c) => c.lane)) + 1;
    for (const item of cluster) positioned.push({ ...item, lanes: laneCount });
    cluster = [];
    clusterEnd = 0;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.startTime.getTime() >= clusterEnd) flush();

    const laneEnds: number[] = [];
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.endTime.getTime());

    let lane = laneEnds.findIndex((end) => end <= item.startTime.getTime());
    if (lane === -1) lane = laneEnds.length === 0 ? 0 : laneEnds.length;

    cluster.push({ ...item, lane });
    clusterEnd = Math.max(clusterEnd, item.endTime.getTime());
  }
  flush();

  return positioned;
}

/**
 * Grade de horários usada pelas visões de Semana e Dia: colunas de dias,
 * linhas de horas, e cada agendamento posicionado/dimensionado pela
 * duração real (mesma lógica das duas visões — só muda o nº de colunas).
 */
export function TimeGrid({
  days,
  appointments,
  startHour,
  endHour,
  today,
  openSlots,
  closedSegments,
  breakInfo,
  breakMoveHint,
  buildNewHref,
}: {
  days: Date[];
  appointments: GridAppointment[];
  startHour: number;
  endHour: number;
  today: Date;
  /** Por dia (YYYY-MM-DD): células de 15min livres e, se houver, um barbeiro livre nela. */
  openSlots?: Record<string, { minute: number; barberId?: string }[]>;
  /** Por dia (YYYY-MM-DD): trechos fechados pra TODOS os barbeiros considerados. */
  closedSegments?: Record<string, ClosedSegment[]>;
  /** Por dia (YYYY-MM-DD): intervalo arrastável — só quando a semana mostra UM barbeiro. */
  breakInfo?: Record<string, BreakInfo | undefined>;
  /** Dica quando o intervalo não é arrastável (vários barbeiros na mesma coluna). */
  breakMoveHint?: string;
  buildNewHref?: (args: { date: string; time: string; barberId?: string }) => string;
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Cabeçalho dos dias */}
        <div className="flex border-b">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={day.toISOString()} className="flex-1 px-2 pb-2 text-center">
                <p className="text-[11px] uppercase tracking-wide text-foreground-muted">
                  {WEEKDAY_SHORT[day.getUTCDay()]}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday ? "bg-secondary-dark text-white" : "text-foreground"
                  )}
                >
                  {day.getUTCDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Corpo com as horas */}
        <div className="flex" style={{ height: gridHeight }}>
          <div className="w-14 shrink-0">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-foreground-muted">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayAppointments = assignLanes(appointments.filter((a) => isSameDay(a.day, day)));
            return (
              <div key={day.toISOString()} className="relative flex-1 border-l">
                {hours.map((h) => (
                  <div key={h} className="relative border-b border-white/[0.06]" style={{ height: HOUR_HEIGHT }}>
                    {[25, 50, 75].map((pct) => (
                      <span key={pct} className="absolute inset-x-0 border-t border-dashed border-foreground/[0.04]" style={{ top: `${pct}%` }} />
                    ))}
                  </div>
                ))}

                {(closedSegments?.[day.toISOString().slice(0, 10)] ?? [])
                  .filter((segment) => !(breakInfo?.[day.toISOString().slice(0, 10)] && segment.reason === "Intervalo"))
                  .map((segment) => (
                    <ClosedOverlay
                      key={`${segment.start}-${segment.reason}`}
                      segment={segment}
                      startHour={startHour}
                      endHour={endHour}
                      hourHeight={HOUR_HEIGHT}
                      hint={segment.reason === "Intervalo" ? breakMoveHint : undefined}
                    />
                  ))}
                {breakInfo?.[day.toISOString().slice(0, 10)] && (
                  <DraggableBreak info={breakInfo[day.toISOString().slice(0, 10)]!} startHour={startHour} endHour={endHour} hourHeight={HOUR_HEIGHT} />
                )}

                {buildNewHref &&
                  (openSlots?.[day.toISOString().slice(0, 10)] ?? [])
                    .filter((s) => s.minute >= startHour * 60 && s.minute < endHour * 60)
                    .map((s) => (
                      <QuickAddSlot
                        key={s.minute}
                        href={buildNewHref({ date: day.toISOString().slice(0, 10), time: minutesToHHMM(s.minute), barberId: s.barberId })}
                        label={`Agendar ${minutesToHHMM(s.minute)}`}
                        style={{ top: ((s.minute - startHour * 60) / 60) * HOUR_HEIGHT + 1, height: HOUR_HEIGHT / 4 - 2 }}
                      />
                    ))}

                {dayAppointments.map((appt) => {
                  const top = ((minutesFromMidnight(appt.startTime) - startHour * 60) / 60) * HOUR_HEIGHT;
                  const rawHeight =
                    ((minutesFromMidnight(appt.endTime) - minutesFromMidnight(appt.startTime)) / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, rawHeight - 2);
                  const laneWidth = 100 / appt.lanes;
                  return (
                    <AppointmentBlock
                      key={appt.block.id}
                      data={appt.block}
                      actions={appt.actions}
                      // Abaixo de ~38px não cabem as duas linhas sem cortar texto.
                      // Em coluna estreita (3+ simultâneos) também só cabe uma.
                      dense={height < 38 || appt.lanes > 2}
                      style={{
                        top: Math.max(0, top),
                        height,
                        left: `calc(${appt.lane * laneWidth}% + 3px)`,
                        width: `calc(${laneWidth}% - 6px)`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
