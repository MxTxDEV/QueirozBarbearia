import { NextRequest, NextResponse } from "next/server";
import { runSeed } from "@/lib/seed";
import { runDemoSeed, removeDemoData } from "@/lib/demo-seed";
import { prisma } from "@/lib/prisma";

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
 * ?company=<slug>   empresa alvo dos modos demo/remove-demo (padrão: a mais antiga cadastrada)
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
    if (mode === "demo" || mode === "remove-demo") {
      const slug = request.nextUrl.searchParams.get("company");
      const company = slug
        ? await prisma.company.findUnique({ where: { slug }, select: { id: true } })
        : await prisma.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!company) {
        return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
      }
      const result = mode === "demo" ? await runDemoSeed(company.id) : await removeDemoData(company.id);
      return NextResponse.json({ ok: true, mode, companyId: company.id, ...result });
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
