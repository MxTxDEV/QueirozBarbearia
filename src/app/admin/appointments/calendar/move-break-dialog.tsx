"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveBarberBreakAction } from "@/actions/barber-break";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/quick-slots";
import { overlapsAny, validateBreakWindow } from "@/lib/break-move";
import type { BreakInfo } from "./break-types";

const DATE_LABEL = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const WEEKDAY_PLURAL = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];

/**
 * Confirmação antes de mover o intervalo — o arrastar nunca grava sozinho, pra
 * ninguém trocar o almoço sem querer. Mostra de → para, deixa ajustar o horário
 * fino e escolher se vale só pra esse dia ou pra todo o mesmo dia da semana.
 */
export function MoveBreakDialog({
  info,
  proposedStart,
  onClose,
}: {
  info: BreakInfo;
  /** Início proposto (minutos). O fim acompanha, mantendo a duração. */
  proposedStart: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const duration = info.end - info.start;
  const [startTime, setStartTime] = useState(minutesToHHMM(proposedStart));
  const [scope, setScope] = useState<"DAY" | "WEEKDAY">("DAY");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const newStart = hhmmToMinutes(startTime || "00:00");
  const next = { start: newStart, end: newStart + duration };
  const weekday = new Date(`${info.date}T00:00:00.000Z`).getUTCDay();
  const unchanged = next.start === info.start;
  const localError =
    validateBreakWindow(next, { start: info.workStart, end: info.workEnd }) ??
    (scope === "DAY" && overlapsAny(next, info.busy) ? "Já há agendamento nesse horário. Escolha outro." : null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await moveBarberBreakAction({
        barberId: info.barberId,
        date: info.date,
        start: minutesToHHMM(next.start),
        end: minutesToHHMM(next.end),
        scope,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(scope === "DAY" ? "Intervalo movido para este dia." : `Intervalo de todas as ${WEEKDAY_PLURAL[weekday]} atualizado.`);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="move-break-title">
      <div className="absolute inset-0 bg-black/60" onClick={pending ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border bg-[var(--background-elevated)] p-5 shadow-2xl">
        <div>
          <h2 id="move-break-title" className="text-lg font-semibold text-foreground">
            Mover o intervalo?
          </h2>
          <p className="text-sm text-foreground-muted first-letter:uppercase">
            {info.barberName} · {DATE_LABEL.format(new Date(`${info.date}T00:00:00.000Z`))}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border bg-[var(--surface-subtle)] p-3 text-sm">
          <span className="text-foreground-muted line-through">
            {minutesToHHMM(info.start)}–{minutesToHHMM(info.end)}
          </span>
          <span aria-hidden>→</span>
          <span className="font-semibold text-foreground">
            {minutesToHHMM(next.start)}–{minutesToHHMM(next.end)}
          </span>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="break-start" className="text-sm font-medium text-foreground">
            Começa às
          </label>
          <Input id="break-start" type="time" step={900} value={startTime} onChange={(e) => {
              setStartTime(e.target.value);
              setError(null);
            }} className="w-32" />
          <p className="text-xs text-foreground-muted">A duração de {duration} min continua a mesma.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">Aplicar a</legend>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="radio" name="break-scope" checked={scope === "DAY"} onChange={() => {
                setScope("DAY");
                setError(null);
              }} className="mt-1" />
            <span>
              Só neste dia
              <span className="block text-xs text-foreground-muted">As outras datas continuam com o horário de sempre.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="radio" name="break-scope" checked={scope === "WEEKDAY"} onChange={() => {
                setScope("WEEKDAY");
                setError(null);
              }} className="mt-1" />
            <span>
              Todas as {WEEKDAY_PLURAL[weekday]}
              <span className="block text-xs text-foreground-muted">Muda o padrão semanal (a partir deste dia).</span>
            </span>
          </label>
        </fieldset>

        {(localError || error) && <p className="text-sm text-danger">{error ?? localError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={pending || unchanged || !!localError}>
            {pending ? "Movendo..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
