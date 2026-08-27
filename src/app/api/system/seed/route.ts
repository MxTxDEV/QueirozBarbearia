import { NextRequest, NextResponse } from "next/server";
import { runSeed } from "@/lib/seed";
import { runDemoSeed, removeDemoData } from "@/lib/demo-seed";

/**
 * Endpoint de seed protegido por segredo — existe para permitir popular o
 * banco em ambientes onde a conexão direta (TCP) ao Postgres não está
 * disponível para quem está fazendo o deploy, mas uma chamada HTTPS está.
 * Requer SEED_SECRET configurado nas variáveis de ambiente; sem ele, a
 * rota recusa qualquer chamada.
 *
 * ?mode=base   (padrão) dados essenciais: admin, barbeiros, catálogo base
 * ?mode=demo   dados de demonstração: cortes, clientes e atendimentos
 * ?mode=remove-demo   remove os dados de demonstração
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

  const mode = request.nextUrl.searchParams.get("mode") ?? "base";

  try {
    if (mode === "demo") {
      return NextResponse.json({ ok: true, mode, ...(await runDemoSeed()) });
    }
    if (mode === "remove-demo") {
      return NextResponse.json({ ok: true, mode, ...(await removeDemoData()) });
    }
    if (mode !== "base") {
      return NextResponse.json({ error: `mode inválido: ${mode}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, mode, ...(await runSeed()) });
  } catch (error) {
    console.error("[seed] falha ao executar:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao executar o seed." },
      { status: 500 }
    );
  }
}
