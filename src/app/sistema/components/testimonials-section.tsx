import { Quote } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";

/**
 * Sem depoimentos reais ainda — em vez de inventar nomes/avaliações,
 * mostra o espaço já estruturado pra receber os primeiros relatos assim
 * que existirem (troque este array por objetos { quote, name, barbershop }).
 */
export function TestimonialsSection() {
  return (
    <section id="depoimentos" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-[var(--ic-white)] sm:text-4xl">Barbearias que confiam no iCortes</h2>
        </Reveal>
        <Reveal delayMs={60}>
          <p className="mx-auto mt-4 max-w-md text-center text-[var(--ic-muted)]">
            Em breve, histórias reais de quem já organiza a operação com o iCortes no dia a dia.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Reveal key={i} delayMs={i * 80}>
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ic-border-strong)] p-8 text-center">
                <Quote className="h-6 w-6 text-[var(--ic-muted-dark)]" strokeWidth={1.5} />
                <p className="mt-4 text-sm text-[var(--ic-muted-dark)]">Espaço reservado para um depoimento real</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
