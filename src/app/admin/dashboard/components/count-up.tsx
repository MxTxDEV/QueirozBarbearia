"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";

/**
 * Anima um número de 0 até `value` com requestAnimationFrame (sem
 * bibliotecas extras). Curto e rápido — 900ms com easing de desaceleração.
 *
 * A contagem reinicia toda vez que o número reentra na viewport (não só
 * na primeira montagem), para acompanhar a animação reversível das seções.
 * Pula direto para o valor final se prefers-reduced-motion estiver ativo.
 *
 * `format` é um identificador, não uma função: este é um Client Component
 * e funções não podem ser passadas por um Server Component.
 */
export function CountUp({
  value,
  durationMs = 900,
  format = "currency",
}: {
  value: number;
  durationMs?: number;
  format?: "currency" | "integer";
}) {
  const [display, setDisplay] = useState(0);
  const hostRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const cancel = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frameRef.current = requestAnimationFrame(() => setDisplay(value));
      return cancel;
    }

    function run() {
      cancel();
      const start = performance.now();
      function tick(now: number) {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(value * eased);
        if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) run();
        else {
          cancel();
          setDisplay(0);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      cancel();
    };
  }, [value, durationMs]);

  return (
    <span ref={hostRef}>
      {format === "currency" ? formatCurrency(display) : Math.round(display).toLocaleString("pt-BR")}
    </span>
  );
}
