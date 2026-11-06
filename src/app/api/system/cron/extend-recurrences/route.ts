import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extendAllRecurringSeries } from "@/lib/recurring-engine";

/** Compara em tempo constante — evita que a duração da comparação vaze, byte a byte, o segredo correto. */
function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rota protegida por segredo: estende as recorrências ativas já cadastradas com as datas seguintes até
 * dezembro de 2027 (ou até `?until=AAAA-MM-DD`). Idempotente — pode ser chamada de novo sem duplicar nada.
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
    const until = request.nextUrl.searchParams.get("until") ?? undefined;
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return NextResponse.json({ error: "until inválido (AAAA-MM-DD)." }, { status: 400 });
    const { results, ...summary } = await extendAllRecurringSeries({ target: until });
    return NextResponse.json({ ok: true, ...summary, extendedSeries: results.filter((r) => r.outcome === "extended") });
  } catch (error) {
    console.error("[cron] falha ao estender recorrências:", error);
    return NextResponse.json({ error: "Erro ao executar o job." }, { status: 500 });
  }
}
