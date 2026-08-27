"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";

/**
 * Anima um número de 0 até `value` com requestAnimationFrame (sem
 * bibliotecas extras). Curto e rápido — 900ms com easing de desaceleração.
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
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      // Ainda assim via rAF: evita setState síncrono direto no corpo do efeito.
      frameRef.current = requestAnimationFrame(() => setDisplay(value));
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    }

    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return <>{format === "currency" ? formatCurrency(display) : Math.round(display).toLocaleString("pt-BR")}</>;
}
