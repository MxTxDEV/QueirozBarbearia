import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateProgressiveOccurrences } from "@/lib/recurring-engine";

/** Compara em tempo constante — evita que a duração da comparação vaze, byte a byte, o segredo correto. */
function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rota protegida por segredo para acionar via cron externo a geração
 * progressiva de ocorrências de séries recorrentes sem data final (Regra
 * 28/29) — mesmo padrão de /api/system/cron/appointment-reminders e
 * /api/system/cron/waitlist-holds. Idempotente: a unique constraint
 * (recurringAppointmentId, occurrenceNumber) garante que rodar duas vezes
 * nunca duplica uma ocorrência, então pode ser acionada com qualquer
 * frequência.
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
    const result = await generateProgressiveOccurrences();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] falha ao gerar ocorrências recorrentes progressivas:", error);
    return NextResponse.json({ error: "Erro ao executar o job." }, { status: 500 });
  }
}
