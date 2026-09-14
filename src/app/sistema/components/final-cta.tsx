import { ArrowRight } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";
import { SALES_WHATSAPP_URL } from "../whatsapp";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[var(--ic-bg-elevated)] px-6 py-24 sm:px-10 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ic-red)] opacity-[0.07] blur-[160px]" />
      </div>

      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold leading-tight text-[var(--ic-white)] sm:text-4xl">
            Sua barbearia pode continuar no improviso.
            <br />
            Ou começar a ser administrada <span className="text-[var(--ic-red)]">como um negócio.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[var(--ic-muted)]">Comece a organizar sua operação com o iCortes.</p>
          <a
            href={SALES_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[var(--ic-red)] px-8 text-base font-semibold text-white shadow-[0_8px_30px_rgba(225,29,36,0.35)] transition-all hover:bg-[var(--ic-red-light)] hover:shadow-[0_8px_36px_rgba(225,29,36,0.5)]"
          >
            Começar teste grátis
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
