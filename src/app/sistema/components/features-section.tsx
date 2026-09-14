import { CalendarClock, Users, Scissors, Wallet, ShoppingCart, BarChart3, Target, Bell } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";

const FEATURES = [
  { icon: CalendarClock, title: "Agendamento", desc: "Organize horários e facilite o agendamento dos clientes." },
  { icon: Users, title: "Clientes", desc: "Tenha histórico e informações dos seus clientes." },
  { icon: Scissors, title: "Barbeiros", desc: "Acompanhe desempenho, agenda e produtividade." },
  { icon: Wallet, title: "Financeiro", desc: "Saiba quanto entra, quanto sai e quanto sua operação gera." },
  { icon: ShoppingCart, title: "PDV", desc: "Registre vendas e serviços diretamente no sistema." },
  { icon: BarChart3, title: "Relatórios", desc: "Transforme os dados da barbearia em decisões." },
  { icon: Target, title: "Metas", desc: "Crie metas por barbeiro e acompanhe os resultados." },
  { icon: Bell, title: "Lembretes", desc: "Reduza faltas e esquecimentos com lembretes automáticos." },
];

export function FeaturesSection() {
  return (
    <section id="recursos" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-[var(--ic-white)] sm:text-4xl">
            Tudo que sua barbearia precisa. Em um só lugar.
          </h2>
        </Reveal>

        <div className="mx-auto mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delayMs={i * 50}>
              <div className="group h-full rounded-2xl border border-[var(--ic-border)] bg-[var(--ic-card)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--ic-red)]/40 hover:bg-[var(--ic-card-hover)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ic-red)]/12 transition-colors group-hover:bg-[var(--ic-red)]/20">
                  <Icon className="h-5 w-5 text-[var(--ic-red)]" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--ic-white)]">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ic-muted)]">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
