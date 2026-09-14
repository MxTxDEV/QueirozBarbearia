"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

// Proporção nativa de cada arquivo (largura/altura) — os dois variantes vêm
// de recortes com enquadramento levemente diferente, então cada um calcula
// sua própria largura a partir da altura pedida (evita esticar/distorcer).
const ASPECT_RATIO = { light: 554 / 228, dark: 364 / 172 };

/**
 * Logotipo oficial da plataforma (iCortes) — usado nas telas sem uma empresa
 * específica em contexto (landing page, login, sidebar do admin antes de
 * resolver a logo da empresa). "light" (traço claro) é para uso sobre
 * fundos escuros; "dark" (traço original, escuro) é para uso sobre fundos
 * claros/brancos. Sem `variant` explícito, segue o tema ativo
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
  const width = Math.round(height * ASPECT_RATIO[resolvedVariant]);
  return (
    <Image
      src={resolvedVariant === "light" ? "/logo-icortes-light.png" : "/logo-icortes-dark.png"}
      alt="iCortes"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      priority
    />
  );
}
