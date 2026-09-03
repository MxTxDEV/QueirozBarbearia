"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Revela o conteúdo com fade + leve slide/scale na primeira vez que entra
 * na viewport, e fica visível dali em diante (observer desconectado após
 * o primeiro disparo). Não é reversível — uma versão anterior escondia a
 * seção de novo toda vez que saía da tela, o que num dashboard consultado
 * várias vezes por dia (não uma landing page) significava que, assim que
 * o usuário terminava de rolar até o fim, praticamente todo o conteúdo
 * acima ficava em opacity:0 (confirmado inspecionando o layout depois de
 * rolar a tela inteira) — bastava rolar de volta pra cima pra tudo
 * "sumir" e precisar reanimar de novo a cada vez.
 *
 * Usa IntersectionObserver (sem listener de scroll) e respeita
 * prefers-reduced-motion, caso em que aparece direto, sem animação.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // rAF em vez de setState direto no corpo do efeito (evita render em cascata).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[var(--duration-base)] ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0",
        className
      )}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
