import { NextRequest, NextResponse } from "next/server";
import { runSeed } from "@/lib/seed";

/**
 * Endpoint de seed protegido por segredo — existe para permitir popular o
 * banco em ambientes onde a conexão direta (TCP) ao Postgres não está
 * disponível para quem está fazendo o deploy, mas uma chamada HTTPS está.
 * Requer SEED_SECRET configurado nas variáveis de ambiente; sem ele, a
 * rota recusa qualquer chamada.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEED_SECRET não configurado." }, { status: 503 });
  }

  const provided = request.headers.get("x-seed-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await runSeed();
  return NextResponse.json({ ok: true, ...result });
}
