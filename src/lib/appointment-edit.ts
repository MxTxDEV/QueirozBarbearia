/**
 * Parte PURA (sem banco) da edição de agendamento — usada pelo servidor e testável.
 * Horários são guardados como relógio de parede em UTC (ver availability.ts).
 */

export const EDIT_MIN_DURATION_MIN = 5;
export const EDIT_MAX_DURATION_MIN = 720;

export type EditTimes = {
  appointmentDate: Date;
  startTime: Date;
  endTime: Date;
  /** O atendimento termina no mesmo dia em que começa (não atravessa a meia-noite). */
  sameDay: boolean;
};

/** Data "AAAA-MM-DD" + hora "HH:MM" + duração em minutos → datas gravadas no banco. */
export function buildEditTimes(date: string, time: string, durationMin: number): EditTimes {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const startTime = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const endTime = new Date(startTime.getTime() + durationMin * 60_000);
  const appointmentDate = new Date(Date.UTC(year, month - 1, day));
  const midnight = Date.UTC(year, month - 1, day + 1);
  return { appointmentDate, startTime, endTime, sameDay: endTime.getTime() <= midnight };
}

/** Mesmos serviços (ignora ordem e repetição)? */
export function sameServiceSet(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const id of left) if (!right.has(id)) return false;
  return true;
}

/** "AAAA-MM-DD" a partir de uma data guardada (UTC). */
export function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** "HH:MM" a partir de um horário guardado (UTC). */
export function toTimeInput(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

/** Valida que a data e a hora existem de verdade (ex: 2026-02-31 não existe). */
export function isRealDateTime(date: string, time: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return false;
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
