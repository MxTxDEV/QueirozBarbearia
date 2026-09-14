import { Reveal } from "@/app/admin/dashboard/components/reveal";

const STATS = [
  { value: "1", label: "sistema completo" },
  { value: "8+", label: "módulos de gestão" },
  { value: "24/7", label: "acesso" },
  { value: "100%", label: "online" },
];

/** Indicadores do próprio produto — nunca métricas de negócio/clientes inventadas. */
export function ResultsStrip() {
  return (
    <section className="border-y border-[var(--ic-border)] bg-[var(--ic-overlay)] px-6 py-16 sm:px-10">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 sm:grid-cols-4">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delayMs={i * 70} className="text-center">
            <p className="text-4xl font-extrabold text-[var(--ic-white)] sm:text-5xl">
              {stat.value}
              <span className="text-[var(--ic-red)]">.</span>
            </p>
            <p className="mt-1.5 text-sm text-[var(--ic-muted)]">{stat.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
