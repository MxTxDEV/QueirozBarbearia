import { Lock } from "lucide-react";
import type { ClosedSegment } from "@/lib/quick-slots";

/**
 * Trecho "trancado" da grade: o barbeiro não atende (fora do expediente,
 * intervalo, folga, bloqueio…). Listrado e apagado, com cadeado e o motivo —
 * sem clique, só o tooltip. Fica por baixo dos agendamentos (um agendamento
 * feito antes de o horário ser trancado continua visível).
 */
export function ClosedOverlay({
  segment,
  startHour,
  endHour,
  hourHeight,
  hint,
}: {
  segment: ClosedSegment;
  startHour: number;
  endHour: number;
  hourHeight: number;
  /** Complemento do tooltip (ex.: como mover o intervalo). */
  hint?: string;
}) {
  const start = Math.max(segment.start, startHour * 60);
  const end = Math.min(segment.end, endHour * 60);
  if (end <= start) return null;

  const top = ((start - startHour * 60) / 60) * hourHeight;
  const height = ((end - start) / 60) * hourHeight;

  return (
    <div
      role="img"
      aria-label={`Fechado: ${segment.reason}`}
      title={`Fechado — ${segment.reason}${hint ? ` (${hint})` : ""}`}
      style={{
        top,
        height,
        backgroundColor: "var(--surface-subtle)",
        backgroundImage: "repeating-linear-gradient(135deg, var(--border-glass) 0 1px, transparent 1px 9px)",
      }}
      className="absolute inset-x-0 flex cursor-not-allowed select-none items-center justify-center gap-1.5 overflow-hidden text-foreground-muted/70"
    >
      {height >= 24 && (
        <span className="flex items-center gap-1 rounded-full bg-[var(--background-elevated)]/80 px-2 py-0.5 text-[10px] font-medium">
          <Lock className="h-3 w-3" />
          {height >= 40 && <span className="truncate">{segment.reason}</span>}
        </span>
      )}
    </div>
  );
}
