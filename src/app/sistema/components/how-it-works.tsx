import { Reveal } from "@/app/admin/dashboard/components/reveal";

const STEPS = [
  { n: "01", title: "Cadastre sua barbearia", desc: "Configure sua equipe e seus serviços." },
  { n: "02", title: "Organize sua operação", desc: "Gerencie agenda, clientes, equipe e financeiro." },
  { n: "03", title: "Acompanhe seus resultados", desc: "Use os dados para tomar decisões melhores." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-[var(--ic-white)] sm:text-4xl">Como funciona</h2>
        </Reveal>

        <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delayMs={i * 100}>
              <div className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-6 top-14 hidden h-px w-full bg-gradient-to-r from-[var(--ic-border-strong)] to-transparent sm:block" />
                )}
                <span className="text-5xl font-extrabold text-[var(--ic-border-strong)]">{step.n}</span>
                <h3 className="mt-4 text-xl font-semibold text-[var(--ic-white)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ic-muted)]">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={300}>
          <p className="mx-auto mt-16 max-w-lg text-center text-lg font-medium text-[var(--ic-white)]">
            Do primeiro agendamento ao fechamento do mês, <span className="text-[var(--ic-red)]">tudo conectado.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
