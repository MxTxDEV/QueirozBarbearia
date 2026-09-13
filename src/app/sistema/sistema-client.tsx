"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ShoppingCart,
  BarChart3,
  Target,
  Bell,
  Users,
  Scissors,
  ArrowRight,
  ArrowDown,
  Check,
  MessageCircle,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/app/admin/dashboard/components/reveal";
import { CombIcon, ClipperIcon, SprayBottleIcon } from "./barber-icons";
import { cn, formatCurrency } from "@/lib/utils";

const SALES_WHATSAPP_NUMBER = "5531997184670";
const SALES_WHATSAPP_MESSAGE = "Olá! Vi o BarberPro e quero saber mais sobre o sistema para minha barbearia.";
const salesWhatsappUrl = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${encodeURIComponent(SALES_WHATSAPP_MESSAGE)}`;

type PeriodId = "anual" | "semestral" | "mensal";

const PERIODS: { id: PeriodId; label: string; sublabel: string; discountPct: number; months: number }[] = [
  { id: "anual", label: "Anual", sublabel: "30% de desconto", discountPct: 30, months: 12 },
  { id: "semestral", label: "Semestral", sublabel: "15% de desconto", discountPct: 15, months: 6 },
  { id: "mensal", label: "Mensal", sublabel: "sem desconto", discountPct: 0, months: 1 },
];

// basePrice = mensal sem desconto. anualPrice = valor exato divulgado pra
// assinatura anual (arredondado pra terminar em ",90"/",15" — não é
// simplesmente 30% de basePrice, por isso fica explícito em vez de
// calculado). Semestral não tem valor divulgado ainda, então é calculado
// (15% sobre basePrice) até existir um preço oficial pra essa opção.
const PLAN_TIERS = [
  { id: "1", label: "1 profissional", basePrice: 79.9, anualPrice: 55.9 },
  { id: "2-5", label: "2 a 5 profissionais", basePrice: 109.9, anualPrice: 76.9 },
  { id: "6-15", label: "6 a 15 profissionais", basePrice: 164.5, anualPrice: 115.15 },
  { id: "15+", label: "+15 profissionais", basePrice: 219.9, anualPrice: 153.9 },
];

const FEATURES = [
  { icon: CalendarClock, title: "Agenda online", desc: "Seus clientes agendam sozinhos, sem precisar ligar ou mandar mensagem." },
  { icon: ShoppingCart, title: "PDV completo", desc: "Venda serviços e produtos rápido, direto no balcão." },
  { icon: BarChart3, title: "Financeiro", desc: "Receitas, despesas e fluxo de caixa organizados automaticamente." },
  { icon: Target, title: "Metas por barbeiro", desc: "Acompanhe o desempenho de cada profissional em tempo real." },
  { icon: Bell, title: "Lembretes automáticos", desc: "Clientes avisados por WhatsApp antes do horário — menos faltas." },
  { icon: Users, title: "Multiusuário", desc: "Admin e barbeiros, cada um com o acesso certo." },
];

const BENEFITS = [
  "Menos tempo perdido organizando agenda no caderno ou WhatsApp",
  "Controle financeiro completo, sem depender de planilhas",
  "Metas e desempenho de cada barbeiro, em tempo real",
  "Cliente lembrado automaticamente do horário marcado",
];

function PricingSection() {
  const [periodId, setPeriodId] = useState<PeriodId>("anual");
  const period = PERIODS.find((p) => p.id === periodId)!;

  return (
    <section id="precos" className="relative px-6 py-24 sm:px-10">
      <Reveal>
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-foreground sm:text-4xl">Preços</h2>
      </Reveal>

      <Reveal delayMs={60}>
        <div className="glass mx-auto mt-8 flex max-w-md rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodId(p.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-center text-xs font-semibold transition-colors sm:text-sm",
                p.id === periodId ? "bg-secondary-dark text-white" : "text-foreground-muted hover:text-foreground"
              )}
            >
              <span className="block uppercase tracking-wide">{p.label}</span>
              <span className="block text-[10px] font-normal normal-case opacity-80 sm:text-xs">{p.sublabel}</span>
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_TIERS.map((tier, i) => {
          const monthly =
            periodId === "anual" ? tier.anualPrice : periodId === "mensal" ? tier.basePrice : tier.basePrice * (1 - period.discountPct / 100);
          const total = monthly * period.months;
          const message = `Olá! Tenho interesse no plano ${tier.label} (${period.label}) do BarberPro.`;
          const planWhatsappUrl = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

          return (
            <Reveal key={tier.id} delayMs={i * 70}>
              <div className="glass relative flex h-full flex-col rounded-2xl p-6">
                {period.discountPct > 0 && (
                  <Badge variant="warning" className="absolute right-4 top-4">
                    {period.discountPct}% OFF
                  </Badge>
                )}
                <p className="text-sm font-medium text-foreground-muted">{tier.label}</p>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">{formatCurrency(monthly)}</span>
                  <span className="text-sm text-foreground-muted">/mês</span>
                </div>
                {period.discountPct > 0 && (
                  <span className="text-sm text-foreground-muted line-through">{formatCurrency(tier.basePrice)}/mês</span>
                )}

                <p className="mt-3 text-xs text-foreground-muted">Valor total: {formatCurrency(total)}</p>

                <a href={planWhatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-6">
                  <Button className="w-full" variant="secondary">
                    Quero esse plano
                  </Button>
                </a>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal delayMs={280}>
        <p className="mx-auto mt-8 max-w-md text-center text-xs text-foreground-muted">
          Pagamento via Pix. Fale com a gente pelo WhatsApp pra fechar seu plano.
        </p>
      </Reveal>
    </section>
  );
}

export function SistemaClient() {
  return (
    <main className="relative overflow-x-hidden">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="text-sm text-foreground-muted hover:text-foreground">
          ← Voltar
        </Link>
        <ThemeToggle />
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative isolate flex flex-col items-center px-6 pb-24 pt-8 text-center sm:pb-32 sm:pt-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden sm:block">
          <div className="absolute left-[6%] top-[12%] text-secondary-light/25 anim-float-a">
            <Scissors className="h-16 w-16 sm:h-20 sm:w-20" strokeWidth={1.4} />
          </div>
          <div className="absolute right-[8%] top-[20%] text-accent-light/20 anim-float-b">
            <ClipperIcon className="h-20 w-20 sm:h-24 sm:w-24" />
          </div>
          <div className="absolute bottom-[14%] left-[12%] text-secondary-light/20 anim-float-c">
            <CombIcon className="h-14 w-14 sm:h-16 sm:w-16" />
          </div>
          <div className="absolute bottom-[8%] right-[14%] text-accent-light/25 anim-float-a">
            <SprayBottleIcon className="h-14 w-14 sm:h-16 sm:w-16" />
          </div>
        </div>

        <Reveal>
          <div className="mb-8">
            <BrandLogo height={56} />
          </div>
        </Reveal>

        <Reveal delayMs={80}>
          <span className="mb-6 inline-flex items-center rounded-full border border-secondary/30 bg-secondary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary-light">
            Para donos de barbearia
          </span>
        </Reveal>

        <Reveal delayMs={140}>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-6xl">
            Sua barbearia merece um sistema à altura
          </h1>
        </Reveal>

        <Reveal delayMs={200}>
          <p className="mx-auto mt-6 max-w-xl text-lg text-foreground-muted">
            Agenda online, PDV, financeiro e metas — tudo em um só sistema, do agendamento ao fechamento de caixa.
          </p>
        </Reveal>

        <Reveal delayMs={260}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href={salesWhatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "lg" }))}>
              <MessageCircle className="h-4 w-4" />
              Quero ter esse sistema
            </a>
            <a href="#recursos" className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}>
              Ver recursos
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>
        </Reveal>
      </section>

      {/* ---------- Recursos ---------- */}
      <section id="recursos" className="relative px-6 py-24 sm:px-10">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-foreground sm:text-4xl">
            Tudo que sua barbearia precisa, em um só lugar
          </h2>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delayMs={i * 70}>
              <div className="glass h-full rounded-2xl p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                  <Icon className="h-6 w-6 text-secondary-light" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-foreground-muted">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <PricingSection />

      {/* ---------- Benefícios ---------- */}
      <section className="relative px-6 py-24 sm:px-10">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-foreground sm:text-4xl">
            Por que barbearias estão migrando pro BarberPro?
          </h2>
        </Reveal>

        <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-5">
          {BENEFITS.map((b, i) => (
            <Reveal key={b} delayMs={i * 80}>
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                  <Check className="h-4 w-4 text-secondary-light" />
                </span>
                <p className="text-base font-medium text-foreground sm:text-lg">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- CTA final ---------- */}
      <section className="relative px-6 pb-28 pt-8 sm:px-10">
        <Reveal>
          <div className="glass mx-auto max-w-2xl rounded-3xl p-10 text-center sm:p-14">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Pronto pra profissionalizar sua barbearia?</h2>
            <p className="mx-auto mt-3 max-w-md text-foreground-muted">
              Fale com a gente agora pelo WhatsApp e veja como colocar o BarberPro pra funcionar na sua barbearia.
            </p>
            <a href={salesWhatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-block">
              <Button size="lg">
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
