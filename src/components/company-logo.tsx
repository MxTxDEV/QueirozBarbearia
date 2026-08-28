import { cn } from "@/lib/utils";

/**
 * Logo da empresa (tenant), configurável em /admin/settings. Sem logo
 * definida, cai para o nome da empresa em texto — nunca mostra a logo de
 * outra empresa como "padrão". Usa <img> puro (não next/image) porque a URL
 * é definida livremente pelo administrador de cada empresa, fora do
 * domínio conhecido em tempo de build.
 */
export function CompanyLogo({
  logoUrl,
  name,
  height = 28,
  className,
}: {
  logoUrl?: string | null;
  name: string;
  height?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        style={{ height }}
        className={cn("w-auto max-w-[180px] object-contain", className)}
      />
    );
  }

  return (
    <span
      className={cn("truncate font-semibold tracking-tight text-foreground", className)}
      style={{ fontSize: Math.round(height * 0.6), lineHeight: 1 }}
    >
      {name}
    </span>
  );
}
