import { cn } from "@/lib/utils";
import { MARK_COLOR, appliesToBarber, markReason, type MarkKind } from "@/lib/day-marks";
import { hhmmToMinutes } from "@/lib/quick-slots";
import type { DayMarkRow } from "@/lib/data/day-marks";

/**
 * Pinta a coluna de um dia/barbeiro com a cor da marca (feriado = vermelho, folga = azul, fora de expediente = roxo):
 * dia inteiro → a coluna toda; com horário → só a faixa. Fica por cima do "trancado" e por baixo dos agendamentos,
 * sem pegar clique.
 */
export function MarkFill({
  marks,
  barberId,
  startHour,
  endHour,
  hourHeight,
}: {
  marks: DayMarkRow[];
  /** Quando a coluna é de UM barbeiro (ou a agenda está filtrada em um): só entram as marcas da barbearia toda e as dele. */
  barberId?: string | null;
  startHour: number;
  endHour: number;
  hourHeight: number;
}) {
  return (
    <>
      {marks
        .filter((m) => (barberId ? appliesToBarber(m, barberId) : m.barberId === null))
        .map((m) => {
          const color = MARK_COLOR[m.kind as MarkKind];
          if (!color) return null;
          const key = `${m.id}`;
          if (!m.startTime || !m.endTime) {
            return <div key={key} aria-hidden title={markReason(m)} className={cn("pointer-events-none absolute inset-0", color.fill)} />;
          }
          const start = Math.max(hhmmToMinutes(m.startTime), startHour * 60);
          const end = Math.min(hhmmToMinutes(m.endTime), endHour * 60);
          if (end <= start) return null;
          return (
            <div
              key={key}
              aria-hidden
              title={markReason(m)}
              className={cn("pointer-events-none absolute inset-x-0", color.band)}
              style={{ top: ((start - startHour * 60) / 60) * hourHeight, height: ((end - start) / 60) * hourHeight }}
            />
          );
        })}
    </>
  );
}

/** Classe de fundo (cabeçalho do dia) da cor dominante entre as marcas — vazio se não há marcas. */
export function headerFill(marks: DayMarkRow[], barberId?: string | null) {
  const applicable = marks.filter((m) => (barberId ? appliesToBarber(m, barberId) : m.barberId === null));
  for (const kind of ["HOLIDAY", "DAY_OFF", "OUT_OF_HOURS"] as const) {
    if (applicable.some((m) => m.kind === kind)) return MARK_COLOR[kind].fill;
  }
  return "";
}
