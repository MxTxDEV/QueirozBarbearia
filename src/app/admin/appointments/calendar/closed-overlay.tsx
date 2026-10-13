"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
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
  hrefTemplate,
}: {
  segment: ClosedSegment;
  startHour: number;
  endHour: number;
  hourHeight: number;
  /** Complemento do tooltip (ex.: como mover o intervalo). */
  hint?: string;
  /** Link de "Novo agendamento" com TIME_PLACEHOLDER no lugar do horário: dá pra clicar no trecho e agendar fora do expediente. */
  hrefTemplate?: string;
}) {
  const router = useRouter();
  const start = Math.max(segment.start, startHour * 60);
  const end = Math.min(segment.end, endHour * 60);
  if (end <= start) return null;

  const top = ((start - startHour * 60) / 60) * hourHeight;
  const height = ((end - start) / 60) * hourHeight;

  // Só o que é "horário" (expediente, intervalo): folga, feriado e bloqueio continuam fechados de verdade.
  const bookable = Boolean(hrefTemplate) && /^(Fora do expediente|Fora de expediente|Intervalo|Não atende neste dia)/.test(segment.reason);

  function pick(event: React.MouseEvent<HTMLElement>) {
    if (!bookable || !hrefTemplate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = start + ((event.clientY - rect.top) / hourHeight) * 60;
    const minute = Math.min(21 * 60 + 45, Math.max(5 * 60, Math.floor(raw / 15) * 15));
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    router.push(hrefTemplate.replace("TIME_PLACEHOLDER", encodeURIComponent(time)));
  }

  return (
    <div
      role={bookable ? "button" : "img"}
      aria-label={bookable ? `${segment.reason} — clique para agendar mesmo assim` : `Fechado: ${segment.reason}`}
      onClick={bookable ? pick : undefined}
      title={bookable ? `${segment.reason} — clique para agendar fora do expediente` : `Fechado — ${segment.reason}${hint ? ` (${hint})` : ""}`}
      style={{
        top,
        height,
        backgroundColor: "var(--surface-subtle)",
        backgroundImage: "repeating-linear-gradient(135deg, var(--border-glass) 0 1px, transparent 1px 9px)",
      }}
      className={`absolute inset-x-0 flex ${bookable ? "cursor-pointer hover:bg-secondary/10" : "cursor-not-allowed"} select-none items-center justify-center gap-1.5 overflow-hidden text-foreground-muted/70`}
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
