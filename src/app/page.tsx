import Link from "next/link";
import { CalendarClock, Wallet, MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function LandingPage() {
  // Página de marketing da plataforma: o botão "Agendar meu horário" aponta
  // para o portal da empresa mais antiga cadastrada (ambiente com uma única
  // barbearia em produção). Cada barbearia real deve divulgar diretamente o
  // link do seu próprio portal (/portal/[slug]/login).
  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" }, select: { slug: true } });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mb-6">
        <BrandLogo height={64} />
      </div>
      <p className="mb-10 max-w-xl text-center text-foreground-muted">
        Agendamento online, gestão financeira e comunicação por WhatsApp em um só lugar,
        para barbearias que querem crescer com organização.
      </p>

      <div className="mb-12 flex flex-col gap-3 sm:flex-row">
        <Link href={company ? `/portal/${company.slug}/login` : "/portal"}>
          <Button size="lg" className="w-full sm:w-auto">
            Agendar meu horário
          </Button>
        </Link>
        <Link href="/login">
          <Button size="lg" variant="secondary" className="w-full sm:w-auto">
            Painel administrativo
          </Button>
        </Link>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <CalendarClock className="h-6 w-6 text-secondary-light" />
            <p className="text-sm font-medium text-foreground">Agendamento inteligente</p>
            <p className="text-xs text-foreground-muted">Sem conflitos de horário, com confirmação automática.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <Wallet className="h-6 w-6 text-accent-light" />
            <p className="text-sm font-medium text-foreground">Financeiro completo</p>
            <p className="text-xs text-foreground-muted">Receitas, despesas, metas e fluxo de caixa em tempo real.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <MessageCircle className="h-6 w-6 text-secondary-light" />
            <p className="text-sm font-medium text-foreground">WhatsApp integrado</p>
            <p className="text-xs text-foreground-muted">Confirmações, lembretes e cancelamentos automáticos.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
