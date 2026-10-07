import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { originFromHeaders, rememberOrigin } from "@/lib/app-url";
import { sendMonthlyRecurrenceNotices } from "@/lib/monthly-recurrence-notices";

/** Compara em tempo constante — evita que a duração da comparação vaze, byte a byte, o segredo correto. */
function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rota protegida por segredo para acionar via cron externo (ex: Coolify scheduled task) o aviso
 * mensal de recorrência por WhatsApp — mesmo padrão de /api/system/cron/appointment-reminders.
 * Pode ser acionada com qualquer frequência (ex: a cada 15 min): o job só age nos dias 1–3 do mês,
 * das 9h às 19h, e cada cliente recebe no máximo um aviso por mês. Requer CRON_SECRET.
 *
 * Disparo manual (ex: ativou o recurso no meio do mês): `?force=1` ignora a janela de dias/horário
 * (continua valendo "no máximo um aviso por cliente por mês"); `&limit=N` (até 100) muda o tamanho do lote.
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

  // Sem APP_URL configurada, os links de confirmação usam o endereço pelo qual o cron chamou.
  rememberOrigin(originFromHeaders((header) => request.headers.get(header)));

  try {
    const params = request.nextUrl.searchParams;
    const rawLimit = Number(params.get("limit"));
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(100, Math.floor(rawLimit)) : undefined;
    const result = await sendMonthlyRecurrenceNotices({ ignoreWindow: params.get("force") === "1", limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] falha ao enviar avisos mensais de recorrência:", error);
    return NextResponse.json({ error: "Erro ao executar o job." }, { status: 500 });
  }
}
