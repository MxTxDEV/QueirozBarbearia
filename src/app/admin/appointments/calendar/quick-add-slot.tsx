import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão "+" de agendamento rápido sobre um horário livre do calendário —
 * invisível até passar o mouse/focar, pra não poluir a grade. Leva ao
 * formulário de novo agendamento já com data/hora (e barbeiro) preenchidos.
 */
export function QuickAddSlot({
  href,
  label,
  style,
  className,
}: {
  href: string;
  label: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      style={style}
      className={cn(
        "absolute inset-x-0.5 flex items-center justify-center rounded-md border border-dashed border-transparent text-secondary-light",
        "opacity-0 transition-opacity hover:border-secondary hover:bg-secondary/20 hover:opacity-100",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60",
        className
      )}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </Link>
  );
}
