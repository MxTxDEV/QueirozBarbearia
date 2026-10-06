"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";
import { minutesToHHMM } from "@/lib/quick-slots";
import type { BreakInfo } from "./break-types";
import { MoveBreakDialog } from "./move-break-dialog";

/**
 * Visão de Mês: não há eixo de horas pra arrastar, então o intervalo do dia
 * vira uma etiqueta; clicar abre a mesma confirmação, onde se escolhe o novo
 * horário (e se vale só pra esse dia ou pra todo o mesmo dia da semana).
 */
export function BreakChip({ info }: { info: BreakInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Clique para mudar o horário do intervalo neste dia"
        aria-label={`Intervalo de ${info.barberName} neste dia: ${minutesToHHMM(info.start)} às ${minutesToHHMM(info.end)}. Clique para mudar.`}
        className="flex w-full items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-left text-[10px] text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
      >
        <Utensils className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {minutesToHHMM(info.start)}–{minutesToHHMM(info.end)}
        </span>
      </button>
      {open && <MoveBreakDialog info={info} proposedStart={info.start} onClose={() => setOpen(false)} />}
    </>
  );
}
