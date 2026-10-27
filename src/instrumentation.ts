/**
 * Roda uma vez quando o servidor sobe. Liga o agendador embutido dos lembretes automáticos do WhatsApp
 * (ver src/lib/scheduler.ts) — só no runtime Node e nunca durante o `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const setting = (process.env.BUILTIN_SCHEDULER ?? "").toLowerCase();
  if (setting === "off" || setting === "0" || setting === "false") return;
  if (process.env.NODE_ENV !== "production" && setting !== "on") return;

  const { startBuiltInScheduler } = await import("@/lib/scheduler");
  startBuiltInScheduler();
}
