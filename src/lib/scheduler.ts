import "server-only";
import { sendDueAppointmentReminders } from "@/lib/appointment-reminders";
import { sendMonthlyRecurrenceNotices } from "@/lib/monthly-recurrence-notices";
import { expireDueWaitlistHolds } from "@/lib/waitlist-engine";
import { generateProgressiveOccurrences } from "@/lib/recurring-engine";
import { checkOverdueExpensesAndNotify } from "@/lib/overdue-expenses";
import { markSchedulerRun } from "@/lib/scheduler-status";

/**
 * Agendador embutido: roda dentro do próprio servidor, sem depender de ninguém chamar as rotas
 * /api/system/cron/* de fora (Coolify scheduled task, cron-job.org…). Executa os mesmos jobs dessas
 * rotas — todos idempotentes (lembretes reivindicam antes de enviar; ocorrências têm unique; reservas da
 * lista de espera têm CAS) —, então conviver com um cron externo também ligado não duplica nada.
 *
 *   • todo minuto: lembretes (antes do horário e da manhã), avisos mensais, reservas vencidas da lista de espera;
 *   • a cada 30 min: ocorrências de recorrência sem data final e despesas vencidas.
 *
 * Desligar: BUILTIN_SCHEDULER=off. Em desenvolvimento só liga com BUILTIN_SCHEDULER=on.
 */
const TICK_MS = 60_000;
const FIRST_TICK_DELAY_MS = 20_000;
const SLOW_EVERY_TICKS = 30;

type SchedulerState = { timer: ReturnType<typeof setInterval>; running: boolean; ticks: number };
const globalState = globalThis as typeof globalThis & { __icortesScheduler?: SchedulerState };

async function job(name: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    console.error(`[scheduler] falha em "${name}":`, error);
  }
}

export async function runSchedulerTick(options: { slow: boolean }) {
  await job("lembretes", sendDueAppointmentReminders);
  // Carimba logo após os lembretes: é o que a tela WhatsApp mostra como "agendador em dia".
  await job("registro de execução", () => markSchedulerRun());
  await job("avisos mensais de recorrência", () => sendMonthlyRecurrenceNotices({ limit: 5 }));
  await job("reservas vencidas da lista de espera", expireDueWaitlistHolds);
  if (options.slow) {
    await job("ocorrências de recorrência", generateProgressiveOccurrences);
    await job("despesas vencidas", checkOverdueExpensesAndNotify);
  }
}

export function startBuiltInScheduler() {
  if (globalState.__icortesScheduler) return; // já ligado neste processo (recarga do dev, registro duplicado)

  const state: SchedulerState = { timer: undefined as unknown as ReturnType<typeof setInterval>, running: false, ticks: 0 };

  const tick = async () => {
    if (state.running) return; // a execução anterior ainda não terminou (envio espaçado): não empilha
    state.running = true;
    try {
      await runSchedulerTick({ slow: state.ticks % SLOW_EVERY_TICKS === 0 });
    } finally {
      state.ticks++;
      state.running = false;
    }
  };

  state.timer = setInterval(() => void tick(), TICK_MS);
  state.timer.unref?.(); // nunca segura o processo vivo na hora de desligar
  setTimeout(() => void tick(), FIRST_TICK_DELAY_MS).unref?.();
  globalState.__icortesScheduler = state;
  console.log("[scheduler] agendador embutido ligado (lembretes a cada 1 min).");
}
