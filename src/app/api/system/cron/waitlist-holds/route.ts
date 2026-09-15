import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { expireDueWaitlistHolds } from "@/lib/waitlist-engine";

/** Compara em tempo constante — evita que a duração da comparação vaze, byte a byte, o segredo correto. */
function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rota protegida por segredo para acionar via cron externo a expiração de
 * reservas temporárias (HOLD) vencidas da lista de espera — mesmo padrão de
 * /api/system/cron/appointment-reminders. Pode ser acionada com qualquer
 * frequência: a idempotência vem do CAS em expireHoldAndRematch (ver
 * src/lib/waitlist-engine.ts), não do agendamento do cron em si. Mesmo sem
 * essa rota nunca rodar, um HOLD vencido já é reconhecido como livre na
 * hora por getAvailableSlots/hasSchedulingConflict — este job só formaliza
 * a transição de estado e dispara a oferta pro próximo da fila.
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
    const result = await expireDueWaitlistHolds();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] falha ao expirar reservas temporárias da lista de espera:", error);
    return NextResponse.json({ error: "Erro ao executar o job." }, { status: 500 });
  }
}
