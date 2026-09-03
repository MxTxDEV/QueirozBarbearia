import { cn } from "@/lib/utils";

/** Bloco de espaço reservado pulsante. Usado nos `loading.tsx` de rota, no lugar
 * do spinner genérico, pra já antecipar o formato real da tela. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-[var(--surface-subtle)] motion-reduce:animate-none", className)} />;
}
