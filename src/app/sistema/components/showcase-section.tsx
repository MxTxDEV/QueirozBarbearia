import Image from "next/image";
import { Check } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";

type ShowcaseSectionProps = {
  id?: string;
  eyebrow: string;
  headline: React.ReactNode;
  text: string;
  bullets?: string[];
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  reverse?: boolean;
  tint?: boolean;
};

/** Bloco "headline + texto + captura de tela real do produto", reusado por Agenda/Financeiro/Equipe. */
export function ShowcaseSection({
  id,
  eyebrow,
  headline,
  text,
  bullets,
  imageSrc,
  imageAlt,
  imageWidth,
  imageHeight,
  reverse,
  tint,
}: ShowcaseSectionProps) {
  return (
    <section id={id} className={`px-6 py-24 sm:px-10 sm:py-32 ${tint ? "bg-[var(--ic-overlay)]" : ""}`}>
      <div className={`mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-16 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <Reveal>
          <div className={reverse ? "lg:pl-4" : undefined}>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ic-red)]">{eyebrow}</span>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-[var(--ic-white)] sm:text-4xl">{headline}</h2>
            <p className="mt-5 text-lg leading-relaxed text-[var(--ic-muted)]">{text}</p>
            {bullets && (
              <ul className="mt-7 space-y-3">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ic-red)]/15">
                      <Check className="h-3 w-3 text-[var(--ic-red)]" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium text-[var(--ic-white)]">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <Reveal delayMs={120}>
          <div className="rounded-2xl border border-[var(--ic-border-strong)] bg-[var(--ic-card)] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)]">
            <div className="overflow-hidden rounded-lg border border-[var(--ic-border)]">
              <Image src={imageSrc} alt={imageAlt} width={imageWidth} height={imageHeight} className="h-auto w-full" loading="lazy" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
