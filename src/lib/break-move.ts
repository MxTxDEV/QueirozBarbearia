/**
 * Regras puras (sem banco) pra mover o intervalo (almoço) no calendário —
 * usadas pelo arrastar do cliente (pra travar/avisar na hora) e pela action do
 * servidor (que revalida tudo, pois o cliente nunca é confiável).
 * Tudo em minutos desde 00:00.
 */

export type Window = { start: number; end: number };

export const BREAK_SNAP_MINUTES = 15;

/** Move `window` por `deltaMinutes` (arredondado ao passo), sem sair de `bounds`; mantém a duração. */
export function shiftWindow(window: Window, deltaMinutes: number, bounds: Window, step = BREAK_SNAP_MINUTES): Window {
  const duration = window.end - window.start;
  const snapped = Math.round(deltaMinutes / step) * step;
  const start = Math.min(Math.max(window.start + snapped, bounds.start), bounds.end - duration);
  return { start, end: start + duration };
}

/** O intervalo `a` invade algum dos `busy`? ([início, fim) — encostar não conta.) */
export function overlapsAny(a: Window, busy: Window[]): boolean {
  return busy.some((b) => a.start < b.end && b.start < a.end);
}

/** Erro de validação pra um novo intervalo dentro do expediente, ou null se está ok. */
export function validateBreakWindow(next: Window, working: Window): string | null {
  if (!(next.end > next.start)) return "O fim do intervalo precisa ser depois do início.";
  if (next.start < working.start || next.end > working.end) return "O intervalo precisa ficar dentro do horário de trabalho.";
  return null;
}
