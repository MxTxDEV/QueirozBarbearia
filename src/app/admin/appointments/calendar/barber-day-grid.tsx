import { AppointmentBlock } from "./appointment-block";
import { assignLanes, type GridAppointment } from "./time-grid";
import { minutesFromMidnight } from "./calendar-dates";
import { QuickAddSlot } from "./quick-add-slot";
import { ClosedOverlay } from "./closed-overlay";
import { DraggableBreak } from "./draggable-break";
import { AppointmentDropZone } from "./appointment-dnd";
import type { BreakInfo } from "./break-types";
import { minutesToHHMM, type ClosedSegment } from "@/lib/quick-slots";

const HOUR_HEIGHT = 80; // px por hora — mesma escala do TimeGrid, pra ficar consistente entre as visões
const MIN_COLUMN_WIDTH = 200; // px — abaixo disso os blocos ficam ilegíveis com 2 linhas

export type BarberDayAppointment = GridAppointment & { barberId: string };

/**
 * Visão de Dia com uma coluna fixa por barbeiro, lado a lado na mesma tela
 * — ao contrário do TimeGrid (colunas = dias), aqui colunas = barbeiros,
 * todos mostrando o MESMO dia. Cada barbeiro fica sempre na mesma coluna
 * (não reagrupa por sobreposição de horário como o TimeGrid faz entre
 * dias), justamente pra comparar as agendas visualmente de forma estável.
 */
export function BarberDayGrid({
  date,
  barbers,
  appointments,
  startHour,
  endHour,
  emptyBarberLabel = "Sem barbeiros cadastrados.",
  openSlots,
  closedSegments,
  breakInfo,
  buildNewHref,
}: {
  /** Dia exibido (YYYY-MM-DD) — destino quando um agendamento é solto numa coluna. */
  date: string;
  barbers: { id: string; name: string }[];
  appointments: BarberDayAppointment[];
  startHour: number;
  endHour: number;
  emptyBarberLabel?: string;
  /** Início (minutos do dia) de cada célula de 15min livre, por barbeiro. */
  openSlots?: Record<string, number[]>;
  /** Trechos fechados (fora do expediente, intervalo, folga, bloqueio), por barbeiro. */
  closedSegments?: Record<string, ClosedSegment[]>;
  /** Intervalo arrastável de cada barbeiro neste dia (ausente = não dá pra mover). */
  breakInfo?: Record<string, BreakInfo | undefined>;
  buildNewHref?: (args: { time: string; barberId: string }) => string;
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;

  if (barbers.length === 0) {
    return <p className="p-6 text-center text-sm text-foreground-muted">{emptyBarberLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: barbers.length * MIN_COLUMN_WIDTH + 56 }}>
        {/* Cabeçalho com o nome de cada barbeiro */}
        <div className="flex border-b">
          <div className="w-14 shrink-0" />
          {barbers.map((barber) => (
            <div key={barber.id} className="flex-1 px-2 pb-2 text-center">
              <p className="truncate text-sm font-semibold text-foreground">{barber.name}</p>
            </div>
          ))}
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

          {barbers.map((barber) => {
            const barberAppointments = assignLanes(appointments.filter((a) => a.barberId === barber.id));
            return (
              <AppointmentDropZone
                key={barber.id}
                date={date}
                barberId={barber.id}
                barberName={barber.name}
                startHour={startHour}
                hourHeight={HOUR_HEIGHT}
                className="relative flex-1 border-l"
              >
                {hours.map((h) => (
                  <div key={h} className="relative border-b border-white/[0.06]" style={{ height: HOUR_HEIGHT }}>
                    {[25, 50, 75].map((pct) => (
                      <span key={pct} className="absolute inset-x-0 border-t border-dashed border-foreground/[0.04]" style={{ top: `${pct}%` }} />
                    ))}
                  </div>
                ))}

                {(closedSegments?.[barber.id] ?? [])
                  .filter((segment) => !(breakInfo?.[barber.id] && segment.reason === "Intervalo"))
                  .map((segment) => (
                    <ClosedOverlay key={`${segment.start}-${segment.reason}`} segment={segment} startHour={startHour} endHour={endHour} hourHeight={HOUR_HEIGHT} />
                  ))}
                {breakInfo?.[barber.id] && (
                  <DraggableBreak info={breakInfo[barber.id]!} startHour={startHour} endHour={endHour} hourHeight={HOUR_HEIGHT} />
                )}

                {buildNewHref &&
                  (openSlots?.[barber.id] ?? [])
                    .filter((m) => m >= startHour * 60 && m < endHour * 60)
                    .map((m) => (
                      <QuickAddSlot
                        key={m}
                        href={buildNewHref({ time: minutesToHHMM(m), barberId: barber.id })}
                        label={`Agendar ${minutesToHHMM(m)} com ${barber.name}`}
                        style={{ top: ((m - startHour * 60) / 60) * HOUR_HEIGHT + 1, height: HOUR_HEIGHT / 4 - 2 }}
                      />
                    ))}

                {barberAppointments.map((appt) => {
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
                      dense={height < 38 || appt.lanes > 2}
                      resize={{ hourHeight: HOUR_HEIGHT, startMinute: minutesFromMidnight(appt.startTime), maxEndMinute: endHour * 60 }}
                      style={{
                        top: Math.max(0, top),
                        height,
                        left: `calc(${appt.lane * laneWidth}% + 3px)`,
                        width: `calc(${laneWidth}% - 6px)`,
                      }}
                    />
                  );
                })}
              </AppointmentDropZone>
            );
          })}
        </div>
      </div>
    </div>
  );
}
