import { cn } from "@/lib/utils";
import { AppointmentBlock, type BlockData } from "./appointment-block";
import { WEEKDAY_SHORT, isSameDay, minutesFromMidnight } from "./calendar-dates";

const HOUR_HEIGHT = 56; // px por hora — define a escala vertical da grade

export type GridAppointment = {
  block: BlockData;
  actions?: React.ReactNode;
  startTime: Date;
  endTime: Date;
  day: Date;
};

type PositionedAppointment = GridAppointment & { lane: number; lanes: number };

/**
 * Distribui em colunas lado a lado os agendamentos que se sobrepõem no
 * tempo — barbeiros diferentes atendem no mesmo horário, e sem isso os
 * blocos se empilhariam um sobre o outro, ilegíveis.
 *
 * Agrupa os que colidem em "clusters" e, dentro de cada um, encaixa cada
 * agendamento na primeira coluna livre. A largura é dividida pelo número
 * de colunas que aquele cluster precisou.
 */
function assignLanes(items: GridAppointment[]): PositionedAppointment[] {
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
}: {
  days: Date[];
  appointments: GridAppointment[];
  startHour: number;
  endHour: number;
  today: Date;
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
                    isToday ? "bg-secondary text-white" : "text-foreground"
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
                  <div key={h} className="border-b border-white/[0.06]" style={{ height: HOUR_HEIGHT }} />
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
