/**
 * Saúde do agendador de lembretes — parte PURA (sem banco), testável.
 * O agendador registra a hora de cada execução; a tela WhatsApp mostra se está em dia.
 */

/** Acima disso sem rodar, os lembretes "1 hora antes" e da manhã já correm risco de atrasar. */
export const SCHEDULER_STALE_AFTER_MIN = 20;

export type SchedulerHealth = { state: "ok" | "stale" | "never"; minutesAgo: number | null };

export function schedulerHealth(lastRun: Date | null, now: Date = new Date()): SchedulerHealth {
  if (!lastRun) return { state: "never", minutesAgo: null };
  const minutesAgo = Math.max(0, Math.floor((now.getTime() - lastRun.getTime()) / 60_000));
  return { state: minutesAgo > SCHEDULER_STALE_AFTER_MIN ? "stale" : "ok", minutesAgo };
}

/** "agora há pouco", "há 5 min", "há 3 h", "há 2 dias". */
export function describeAgo(minutesAgo: number): string {
  if (minutesAgo < 1) return "agora há pouco";
  if (minutesAgo < 60) return `há ${minutesAgo} min`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
