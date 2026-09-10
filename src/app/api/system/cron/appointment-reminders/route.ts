import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendDueAppointmentReminders } from "@/lib/appointment-reminders";

/** Compara em tempo constante — evita que a duração da comparação vaze, byte a byte, o segredo correto. */
function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rota protegida por segredo para acionar via cron externo (ex: Coolify
 * scheduled task, cron-job.org) o envio de lembretes automáticos de
 * agendamento (24h e 1h antes) em todas as empresas. Requer CRON_SECRET
 * configurado; sem ele, a rota recusa qualquer chamada. Pode ser acionada
 * com a frequência que quiser (a cada poucos minutos, inclusive) sem risco
 * de lembrete duplicado — a idempotência vem de reminder24hSentAt/
 * reminder1hSentAt em cada agendamento, não do agendamento do cron em si.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await sendDueAppointmentReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] falha ao enviar lembretes de agendamento:", error);
    return NextResponse.json({ error: "Erro ao executar o job." }, { status: 500 });
  }
}
