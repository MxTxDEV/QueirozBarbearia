import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkOverdueExpensesAndNotify } from "@/lib/overdue-expenses";

/** Compara em tempo constante — evita que a duração da comparação vaze, byte a byte, o segredo correto. */
function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rota protegida por segredo para acionar via cron externo (ex: Coolify
 * scheduled task, cron-job.org) a notificação de despesas vencidas em todas
 * as empresas. Requer CRON_SECRET configurado; sem ele, a rota recusa
 * qualquer chamada — não há como acionar esse job sem o segredo.
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
    const result = await checkOverdueExpensesAndNotify();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] falha ao verificar despesas vencidas:", error);
    return NextResponse.json({ error: "Erro ao executar o job." }, { status: 500 });
  }
}
