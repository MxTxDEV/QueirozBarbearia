import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logotipo oficial da Queiroz Barbearia. "light" (traço claro + vermelho) é
 * para uso sobre fundos escuros; "dark" (traço grafite + vermelho) é para
 * uso sobre fundos claros/brancos.
 */
export function BrandLogo({
  variant = "dark",
  height = 28,
  className,
}: {
  variant?: "light" | "dark";
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * (576 / 193));
  return (
    <Image
      src={variant === "light" ? "/logo-queiroz-light.png" : "/logo-queiroz-transparent.png"}
      alt="Queiroz Barbearia"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      priority
    />
  );
}
