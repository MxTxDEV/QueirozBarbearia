/**
 * Utilitários de data do calendário. Todo o sistema trata horários em UTC
 * (ver `formatTime` em lib/utils e a montagem de slots em lib/availability),
 * então todas as contas aqui também usam UTC — misturar com fuso local
 * deslocaria os blocos na grade.
 */

export type CalendarView = "week" | "day" | "month";

export const CALENDAR_VIEW_LABEL: Record<CalendarView, string> = {
  week: "Semana",
  day: "Dia",
  month: "Mês",
};

export function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Converte "YYYY-MM-DD" em Date UTC; volta para hoje se ausente/ inválido. */
export function parseAnchor(raw?: string): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return dateOnlyUTC(new Date());
}

/** Domingo da semana da data informada (0 = domingo, igual ao weekday de BarberWorkingHour). */
export function startOfWeek(d: Date) {
  return addDays(dateOnlyUTC(d), -dateOnlyUTC(d).getUTCDay());
}

export function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Intervalo [from, to) que a visão precisa carregar. */
export function rangeForView(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "day") {
    const from = dateOnlyUTC(anchor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  // month: grade completa, incluindo os dias vizinhos que preenchem as semanas
  const first = startOfMonth(anchor);
  const from = startOfWeek(first);
  const lastDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const to = addDays(startOfWeek(lastDay), 7);
  return { from, to };
}

/** Nova âncora ao navegar para trás/frente na visão atual. */
export function shiftAnchor(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, direction * 7);
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + direction, 1));
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Rótulo do período exibido na barra do calendário. */
export function periodLabel(view: CalendarView, anchor: Date): string {
  if (view === "day") {
    return `${WEEKDAY_SHORT[anchor.getUTCDay()]}, ${anchor.getUTCDate()} de ${MONTHS[anchor.getUTCMonth()]} de ${anchor.getUTCFullYear()}`;
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    const to = addDays(from, 6);
    const sameMonth = from.getUTCMonth() === to.getUTCMonth();
    if (sameMonth) {
      return `${from.getUTCDate()} – ${to.getUTCDate()} de ${MONTHS[from.getUTCMonth()]} de ${from.getUTCFullYear()}`;
    }
    return `${from.getUTCDate()} de ${MONTHS[from.getUTCMonth()]} – ${to.getUTCDate()} de ${MONTHS[to.getUTCMonth()]} de ${to.getUTCFullYear()}`;
  }
  return `${MONTHS[anchor.getUTCMonth()]} de ${anchor.getUTCFullYear()}`;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function minutesFromMidnight(d: Date) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Janela de horas da grade. Parte de 08h–20h e expande conforme os
 * agendamentos existentes, para nenhum bloco ficar fora da grade.
 */
export function gridHourBounds(appointments: { startTime: Date; endTime: Date }[]) {
  let startHour = 8;
  let endHour = 20;
  for (const a of appointments) {
    startHour = Math.min(startHour, a.startTime.getUTCHours());
    const endsAt = a.endTime.getUTCMinutes() > 0 ? a.endTime.getUTCHours() + 1 : a.endTime.getUTCHours();
    endHour = Math.max(endHour, endsAt);
  }
  return { startHour, endHour: Math.min(24, Math.max(endHour, startHour + 1)) };
}
