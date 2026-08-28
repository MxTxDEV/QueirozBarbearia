"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

/**
 * Logotipo oficial da plataforma (Barber Pro) — usado nas telas sem uma
 * empresa específica em contexto (landing page, login, sidebar do admin
 * antes de resolver a logo da empresa). "light" (traço claro) é para uso
 * sobre fundos escuros; "dark" (traço original, escuro) é para uso sobre
 * fundos claros/brancos. Sem `variant` explícito, segue o tema ativo
 * automaticamente (a maioria dos usos) — só passe `variant` quando a logo
 * estiver sobre um fundo fixo que não muda com o tema.
 */
export function BrandLogo({
  variant,
  height = 28,
  className,
}: {
  variant?: "light" | "dark";
  height?: number;
  className?: string;
}) {
  const { theme } = useTheme();
  const resolvedVariant = variant ?? (theme === "light" ? "dark" : "light");
  const width = Math.round(height * (581 / 429));
  return (
    <Image
      src={resolvedVariant === "light" ? "/logo-barberpro-light.png" : "/logo-barberpro-dark.png"}
      alt="Barber Pro"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      priority
    />
  );
}
