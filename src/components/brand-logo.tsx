import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logotipo oficial da plataforma (Barber Pro) — usado nas telas sem uma
 * empresa específica em contexto (landing page, login, sidebar do admin
 * antes de resolver a logo da empresa). "light" (traço claro) é para uso
 * sobre fundos escuros — o tema padrão do app; "dark" (traço original,
 * escuro) é para uso sobre fundos claros/brancos.
 */
export function BrandLogo({
  variant = "light",
  height = 28,
  className,
}: {
  variant?: "light" | "dark";
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * (581 / 429));
  return (
    <Image
      src={variant === "light" ? "/logo-barberpro-light.png" : "/logo-barberpro-dark.png"}
      alt="Barber Pro"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      priority
    />
  );
}
