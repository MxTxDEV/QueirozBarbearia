import { CalendarX, EyeOff, UserX, Receipt } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";

const PROBLEMS = [
  { icon: CalendarX, title: "Agenda bagunçada", desc: "Horários espalhados e clientes esquecidos." },
  { icon: EyeOff, title: "Falta de controle", desc: "Você trabalha o mês inteiro sem saber exatamente quanto cada barbeiro produziu." },
  { icon: UserX, title: "Clientes perdidos", desc: "Clientes antigos não retornam porque ninguém acompanha." },
  { icon: Receipt, title: "Financeiro confuso", desc: "Entradas, saídas e comissões difíceis de controlar." },
];

export function ProblemSection() {
  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-center text-3xl font-bold leading-tight text-[var(--ic-white)] sm:text-4xl">
            Sua barbearia ainda depende de planilhas, WhatsApp e memória?
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PROBLEMS.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delayMs={i * 70}>
              <div className="h-full rounded-2xl border border-[var(--ic-border)] bg-[var(--ic-card)] p-6">
                <Icon className="h-6 w-6 text-[var(--ic-red)]" strokeWidth={1.75} />
                <h3 className="mt-4 text-lg font-semibold text-[var(--ic-white)]">{title}</h3>
                <p className="mt-1.5 text-sm text-[var(--ic-muted)]">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={280}>
          <p className="mx-auto mt-14 max-w-2xl text-center text-xl font-semibold leading-snug text-[var(--ic-white)] sm:text-2xl">
            O problema não é trabalhar muito. É trabalhar <span className="text-[var(--ic-red)]">sem enxergar o negócio</span>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
