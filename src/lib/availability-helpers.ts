/**
 * Funções puras (sem acesso a banco) usadas pelo motor de disponibilidade
 * em src/lib/availability.ts. Separadas num módulo próprio, sem
 * `import "server-only"`, justamente para poderem ser testadas diretamente
 * (ver src/lib/__tests__/availability-helpers.test.ts) — o guard
 * "server-only" quebra fora do bundler do Next (inclusive em testes).
 */

/** Constrói um Date em UTC para uma data (Y-M-D) e horário "HH:mm" — evita bugs de fuso horário do servidor. */
export function timeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m, 0, 0));
}

export function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
