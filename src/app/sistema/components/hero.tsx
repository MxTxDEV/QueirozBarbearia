import Image from "next/image";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";
import { SALES_WHATSAPP_URL } from "../whatsapp";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-14 sm:px-10 sm:pb-28 sm:pt-20 lg:pt-24">
      {/* Glow vermelho, extremamente discreto — único uso de gradiente da seção */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--ic-red)] opacity-[0.08] blur-[160px]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-[var(--ic-border-strong)] bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ic-muted)]">
              Sistema de gestão para barbearias
            </span>
          </Reveal>

          <Reveal delayMs={80}>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.08] tracking-tight text-[var(--ic-white)] sm:text-6xl lg:text-[3.4rem]">
              Sua barbearia merece mais do que uma agenda. <span className="text-[var(--ic-red)]">Merece gestão.</span>
            </h1>
          </Reveal>

          <Reveal delayMs={160}>
            <p className="mt-6 max-w-xl text-lg text-[var(--ic-muted)]">
              O iCortes reúne agendamentos, clientes, barbeiros, financeiro e resultados em um só lugar. Menos improviso. Mais controle. Mais tempo para
              crescer.
            </p>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href={SALES_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ic-red)] px-7 text-base font-semibold text-white shadow-[0_8px_30px_rgba(225,29,36,0.35)] transition-all hover:bg-[var(--ic-red-light)] hover:shadow-[0_8px_36px_rgba(225,29,36,0.5)] sm:h-14"
              >
                Começar teste grátis
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--ic-border-strong)] px-7 text-base font-semibold text-[var(--ic-white)] transition-colors hover:bg-white/5 sm:h-14"
              >
                Ver como funciona
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={200} className="relative">
          {/* Janela do produto: dashboard real do iCortes */}
          <div className="relative rounded-2xl border border-[var(--ic-border-strong)] bg-[var(--ic-card)] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] sm:p-2.5">
            <div className="flex items-center gap-1.5 px-2 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--ic-border)]">
              <Image
                src="/marketing/screenshot-dashboard.png"
                alt="Dashboard do iCortes mostrando faturamento, atendimentos e evolução de receita"
                width={2000}
                height={1125}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* Celular flutuante, só espiando o canto inferior — pequeno o bastante pra nunca cobrir os números do dashboard atrás */}
          <div className="absolute -bottom-6 -left-8 hidden w-[100px] rounded-[1.1rem] border border-[var(--ic-border-strong)] bg-[var(--ic-card)] p-1.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] sm:block sm:w-[118px]">
            <div className="overflow-hidden rounded-[1rem] border border-[var(--ic-border)]">
              <Image
                src="/marketing/screenshot-mobile.png"
                alt="iCortes no celular, com o dashboard adaptado pra tela pequena"
                width={780}
                height={1688}
                className="h-auto w-full"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
