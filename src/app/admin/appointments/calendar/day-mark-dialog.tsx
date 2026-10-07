"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createDayMarksAction, deleteDayMarkAction, previewDayMarksAction } from "@/actions/day-marks";
import { MARK_COLOR, MARK_HINT, MARK_KINDS, MARK_LABEL, markReason, type MarkKind } from "@/lib/day-marks";
import type { DayMarkRow } from "@/lib/data/day-marks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

const brDate = (iso: string) => iso.split("-").reverse().join("/");
const TITLE_PLACEHOLDER: Record<MarkKind, string> = {
  HOLIDAY: "Ex: Finados",
  DAY_OFF: "Ex: Folga do Marcos",
  OUT_OF_HOURS: "Ex: Manutenção, evento…",
};

/** Botão "Marcar dia" da agenda: feriado, folga ou fora de expediente — e a lista do que já está marcado. */
export function DayMarkButton({
  defaultDate,
  barbers,
  upcoming,
}: {
  /** Dia em foco na agenda (YYYY-MM-DD) — já vem preenchido. */
  defaultDate: string;
  barbers: { id: string; name: string }[];
  upcoming: DayMarkRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} title="Marcar feriado, folga ou fora de expediente">
        <CalendarOff className="h-4 w-4" /> Marcar dia
      </Button>
      {open && <DayMarkModal defaultDate={defaultDate} barbers={barbers} upcoming={upcoming} onClose={() => setOpen(false)} />}
    </>
  );
}

function DayMarkModal({
  defaultDate,
  barbers,
  upcoming,
  onClose,
}: {
  defaultDate: string;
  barbers: { id: string; name: string }[];
  upcoming: DayMarkRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<MarkKind>("HOLIDAY");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState("");
  const [barberId, setBarberId] = useState("");
  const [title, setTitle] = useState("");
  const [partial, setPartial] = useState(false);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("18:00");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ appointments: number; examples: string[] } | null>(null);

  const canPickBarber = kind !== "HOLIDAY" && barbers.length > 0;
  const input = {
    kind,
    startDate,
    endDate,
    barberId: canPickBarber ? barberId : "",
    title,
    startTime: kind === "OUT_OF_HOURS" && partial ? startTime : "",
    endTime: kind === "OUT_OF_HOURS" && partial ? endTime : "",
  };

  function save(acknowledged: boolean) {
    setError(null);
    startTransition(async () => {
      if (!acknowledged) {
        const preview = await previewDayMarksAction(input);
        if (!preview.ok) return setError(preview.error);
        if ((preview.data?.appointments ?? 0) > 0) {
          setWarning({ appointments: preview.data!.appointments, examples: preview.data!.examples });
          return;
        }
      }
      const result = await createDayMarksAction(input);
      if (result.ok) {
        toast.success(`${MARK_LABEL[kind]} marcado${(result.data?.days ?? 1) > 1 ? ` em ${result.data?.days} dias` : ""}.`);
        router.refresh();
        onClose();
      } else {
        setWarning(null);
        setError(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteDayMarkAction(id);
      if (result.ok) {
        toast.success("Marcação removida.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <Modal title="Marcar dia na agenda" icon={<CalendarOff className="h-5 w-5 text-secondary-light" />} onClose={onClose} busy={pending} className="max-w-xl">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de marcação">
          {MARK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setWarning(null);
              }}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-colors",
                kind === k ? MARK_COLOR[k].chip : "text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <span className={cn("h-2.5 w-2.5 rounded-full", MARK_COLOR[k].dot)} /> {MARK_LABEL[k]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground-muted">{MARK_HINT[kind]}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mark-start">{endDate ? "De" : "Dia"}</Label>
            <Input id="mark-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mark-end">Até (opcional)</Label>
            <Input id="mark-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {canPickBarber && (
          <div className="space-y-1.5">
            <Label htmlFor="mark-barber">Vale para</Label>
            <Select id="mark-barber" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">Toda a barbearia</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  Só {b.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {kind === "OUT_OF_HOURS" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="h-4 w-4" />
              Só em um horário do dia (em vez do dia todo)
            </label>
            {partial && (
              <div className="flex items-center gap-2">
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-32" aria-label="Início" />
                <span className="text-sm text-foreground-muted">até</span>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-32" aria-label="Fim" />
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="mark-title">Descrição (opcional)</Label>
          <Input id="mark-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TITLE_PLACEHOLDER[kind]} maxLength={60} />
        </div>

        {warning && (
          <div className="space-y-2 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-foreground">
              Já existe(m) {warning.appointments} agendamento(s) nesse período.
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-foreground-muted">
              {warning.examples.map((e) => (
                <li key={e}>{e}</li>
              ))}
              {warning.appointments > warning.examples.length && <li>… e mais {warning.appointments - warning.examples.length}</li>}
            </ul>
            <p className="text-xs text-foreground-muted">
              Marcar o dia <strong className="text-foreground">não cancela</strong> esses agendamentos — eles continuam na agenda. Você precisa remarcar ou
              cancelar cada um. Novos agendamentos ficam bloqueados.
            </p>
          </div>
        )}

        {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Fechar
          </Button>
          <Button onClick={() => save(Boolean(warning))} disabled={pending || !startDate}>
            {pending ? "Salvando..." : warning ? "Marcar mesmo assim" : `Marcar ${MARK_LABEL[kind].toLowerCase()}`}
          </Button>
        </div>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium text-foreground">Dias marcados ({upcoming.length})</p>
          {upcoming.length === 0 && <p className="text-sm text-foreground-muted">Nada marcado daqui pra frente.</p>}
          <ul className="space-y-1.5">
            {upcoming.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{brDate(m.date)}</span>{" "}
                  <span className={cn("text-xs", (MARK_COLOR[m.kind as MarkKind] ?? MARK_COLOR.HOLIDAY).text)}>{markReason(m)}</span>
                  {m.barberName && <span className="text-xs text-foreground-muted"> · só {m.barberName}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  disabled={pending}
                  aria-label={`Remover marcação de ${brDate(m.date)}`}
                  title="Remover"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
