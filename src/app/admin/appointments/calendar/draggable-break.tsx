"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { minutesToHHMM } from "@/lib/quick-slots";
import { overlapsAny, shiftWindow, BREAK_SNAP_MINUTES } from "@/lib/break-move";
import type { BreakInfo } from "./break-types";
import { MoveBreakDialog } from "./move-break-dialog";

/**
 * Faixa do intervalo (almoço) que se arrasta na vertical pra outro horário do
 * mesmo dia — de 15 em 15 minutos, sem sair do expediente. Soltar não grava:
 * abre a confirmação (MoveBreakDialog). Cai em cima de um agendamento? Fica
 * vermelho e não deixa soltar. Também funciona pelo teclado (setas + Enter).
 */
export function DraggableBreak({
  info,
  startHour,
  endHour,
  hourHeight,
}: {
  info: BreakInfo;
  startHour: number;
  endHour: number;
  hourHeight: number;
}) {
  const pxPerMinute = hourHeight / 60;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const originY = useRef(0);

  const bounds = { start: info.workStart, end: info.workEnd };
  const current = { start: info.start, end: info.end };
  const preview = shiftWindow(current, offset, bounds);
  const moved = preview.start !== info.start;
  const blocked = moved && overlapsAny(preview, info.busy);

  const top = (win: { start: number }) => ((win.start - startHour * 60) / 60) * hourHeight;
  const height = ((info.end - info.start) / 60) * hourHeight;
  if (info.end <= startHour * 60 || info.start >= endHour * 60) return null;

  function finish() {
    setDragging(false);
    if (!moved) return setOffset(0);
    if (blocked) return setOffset(0);
    setConfirming(true);
  }

  return (
    <>
      {moved && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0.5 rounded-md border border-dashed border-foreground/30"
          style={{ top: top(current), height }}
        />
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Intervalo de ${info.barberName}, ${minutesToHHMM(info.start)} às ${minutesToHHMM(info.end)}. Arraste, ou use as setas, para mover.`}
        title="Arraste para mover o intervalo"
        onPointerDown={(e) => {
          if (e.button !== 0 || confirming) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          originY.current = e.clientY;
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          setOffset(Math.round((e.clientY - originY.current) / pxPerMinute / BREAK_SNAP_MINUTES) * BREAK_SNAP_MINUTES);
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          setDragging(false);
          setOffset(0);
        }}
        onKeyDown={(e) => {
          if (confirming) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOffset((o) => o + BREAK_SNAP_MINUTES);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOffset((o) => o - BREAK_SNAP_MINUTES);
          } else if (e.key === "Enter" && moved && !blocked) {
            e.preventDefault();
            setConfirming(true);
          } else if (e.key === "Escape") {
            setOffset(0);
          }
        }}
        style={{
          top: top(preview),
          height,
          touchAction: "none",
          backgroundColor: "var(--surface-subtle)",
          backgroundImage: "repeating-linear-gradient(135deg, var(--border-glass) 0 1px, transparent 1px 9px)",
        }}
        className={cn(
          "absolute inset-x-0 z-[5] flex select-none items-center justify-center overflow-hidden text-foreground-muted/80",
          "cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60",
          dragging && "cursor-grabbing shadow-lg",
          moved && !blocked && "ring-2 ring-secondary",
          blocked && "ring-2 ring-danger",
          !dragging && !moved && "transition-[top] duration-150"
        )}
      >
        <span className="flex items-center gap-1 rounded-full bg-[var(--background-elevated)]/90 px-2 py-0.5 text-[10px] font-medium">
          <GripVertical className="h-3 w-3" />
          {moved ? (
            <span className={cn(blocked && "text-danger")}>
              {minutesToHHMM(preview.start)}–{minutesToHHMM(preview.end)}
              {blocked && " · ocupado"}
            </span>
          ) : height >= 40 ? (
            <span className="truncate">Intervalo {minutesToHHMM(info.start)}–{minutesToHHMM(info.end)}</span>
          ) : null}
        </span>
      </div>

      {confirming && (
        <MoveBreakDialog
          info={info}
          proposedStart={preview.start}
          onClose={() => {
            setConfirming(false);
            setOffset(0);
          }}
        />
      )}
    </>
  );
}
