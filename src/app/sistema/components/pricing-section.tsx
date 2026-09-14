import { Check } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";
import { SALES_WHATSAPP_URL } from "../whatsapp";

/**
 * Estrutura pronta pra receber planos reais (nome, preço, periodicidade,
 * funcionalidades, destaque) assim que existirem — ver PlanCard abaixo.
 * Hoje não há tabela de preços definida, então mostra um único cartão de
 * contato em vez de inventar valores.
 */
type Plan = {
  name: string;
  price?: string;
  period?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Plano personalizado",
    description: "Cada barbearia tem um tamanho de equipe e um volume de atendimentos diferente — o plano é montado pra sua operação, não o contrário.",
    features: [
      "Agendamento, clientes e barbeiros ilimitados",
      "Financeiro, PDV e relatórios completos",
      "Metas e lembretes automáticos",
      "Suporte direto pelo WhatsApp",
    ],
    ctaLabel: "Começar agora",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="planos" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-[var(--ic-white)] sm:text-4xl">Um plano feito pro tamanho da sua barbearia</h2>
        </Reveal>
        <Reveal delayMs={60}>
          <p className="mx-auto mt-4 max-w-md text-center text-[var(--ic-muted)]">Fale com a gente e descubra a condição certa pra você começar hoje.</p>
        </Reveal>

        <div className="mt-14">
          {PLANS.map((plan) => (
            <Reveal key={plan.name}>
              <div
                className={`relative rounded-3xl border p-8 sm:p-10 ${
                  plan.highlighted ? "border-[var(--ic-red)]/50 bg-[var(--ic-card)] shadow-[0_0_0_1px_rgba(225,29,36,0.15),0_30px_70px_-30px_rgba(225,29,36,0.25)]" : "border-[var(--ic-border)] bg-[var(--ic-card)]"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-8 rounded-full bg-[var(--ic-red)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Recomendado
                  </span>
                )}
                <h3 className="text-2xl font-bold text-[var(--ic-white)]">{plan.name}</h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--ic-muted)]">{plan.description}</p>

                <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ic-red)]" strokeWidth={2.5} />
                      <span className="text-sm text-[var(--ic-white)]">{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={SALES_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-[var(--ic-red)] px-8 text-sm font-semibold text-white transition-all hover:bg-[var(--ic-red-light)]"
                >
                  {plan.ctaLabel}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
