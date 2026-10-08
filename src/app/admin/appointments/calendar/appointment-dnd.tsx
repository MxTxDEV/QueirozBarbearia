"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CalendarClock, Timer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { minutesToHHMM } from "@/lib/quick-slots";
import { swapAppointmentsAction } from "@/actions/appointment-swap";
import { moveAppointmentAction } from "@/actions/appointment-move";
import { resizeAppointmentAction } from "@/actions/appointment-resize";
import { TableRow } from "@/components/ui/table";
import type { BlockData } from "./appointment-block";
import type { TouchDropTarget } from "./touch-drag";

/**
 * Arrastar agendamentos na tela de Agendamentos (calendário e lista):
 *  - soltar em cima de OUTRO cliente  → troca os dois de horário;
 *  - soltar num espaço livre da grade → muda o horário (e o barbeiro/dia, conforme a coluna).
 * Nada grava ao soltar: sempre abre uma confirmação, pra ninguém mexer na agenda sem querer.
 */

export const SWAP_MIME = "application/x-appointment-swap";
const SNAP_MINUTES = 15;

export type DragSource = {
  id: string;
  customerName: string;
  timeLabel: string;
  barberName: string;
  durationMin: number;
};

/** O que está sendo arrastado agora (o dataTransfer não deixa ler o conteúdo durante o dragover). */
let currentDrag: (DragSource & { grabOffsetPx: number }) | null = null;

/** Só pendente/confirmado se mexe — concluído, cancelado e falta já aconteceram. */
export const isMovableStatus = (status: string) => status === "PENDING" || status === "CONFIRMED";

function hasPayload(event: React.DragEvent) {
  return event.dataTransfer.types.includes(SWAP_MIME);
}

/**
 * Handlers pra um agendamento que é, ao mesmo tempo, algo que se arrasta e
 * um alvo onde se solta outro agendamento (= trocar os dois).
 */
export function useAppointmentSwapDnd(source: DragSource, movable: boolean) {
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [swapSource, setSwapSource] = useState<DragSource | null>(null);

  const acceptsDrop = (event: React.DragEvent) => movable && !dragging && currentDrag !== null && hasPayload(event);

  const handlers = {
    draggable: movable,
    onDragStart: movable
      ? (event: React.DragEvent<HTMLElement>) => {
          event.dataTransfer.setData(SWAP_MIME, source.id);
          event.dataTransfer.effectAllowed = "move";
          currentDrag = { ...source, grabOffsetPx: event.clientY - event.currentTarget.getBoundingClientRect().top };
          setDragging(true);
        }
      : undefined,
    onDragEnd: () => {
      currentDrag = null;
      setDragging(false);
      setDragOver(false);
    },
    onDragOver: (event: React.DragEvent<HTMLElement>) => {
      if (!acceptsDrop(event)) return;
      event.preventDefault();
      event.stopPropagation(); // não deixa a coluna tratar como "mover pra horário livre"
      event.dataTransfer.dropEffect = "move";
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (event: React.DragEvent<HTMLElement>) => {
      setDragOver(false);
      if (!acceptsDrop(event) || !currentDrag || currentDrag.id === source.id) return;
      event.preventDefault();
      event.stopPropagation();
      const { grabOffsetPx: _grab, ...origin } = currentDrag;
      void _grab;
      setSwapSource(origin);
    },
  };

  const dialog = swapSource ? <SwapConfirmDialog source={swapSource} target={source} onClose={() => setSwapSource(null)} /> : null;
  return { dragging, dragOver, handlers, dialog };
}

/** Linha da lista de agendamentos: arrastável e alvo de troca. */
export function SwappableRow({
  source,
  status,
  children,
}: {
  source: DragSource;
  status: string;
  children: React.ReactNode;
}) {
  const movable = isMovableStatus(status);
  const { dragging, dragOver, handlers, dialog } = useAppointmentSwapDnd(source, movable);
  return (
    <>
      <TableRow
        {...handlers}
        title={movable ? "Arraste sobre outro cliente para trocar os horários" : undefined}
        className={cn(movable && "cursor-grab active:cursor-grabbing", dragging && "opacity-40", dragOver && "bg-secondary/15 outline outline-2 -outline-offset-2 outline-secondary")}
      >
        {children}
      </TableRow>
      {dialog}
    </>
  );
}

type DropProposal = { date: string; time?: string; barberId?: string; barberName?: string };

/**
 * Área da grade (coluna de um dia/barbeiro, ou a célula de um dia no mês) onde se
 * solta um agendamento pra mudar o horário. Na grade de horas o novo horário vem
 * da posição do mouse (de 15 em 15 min, mantendo o ponto em que se pegou o bloco);
 * no mês só o dia muda e a hora é mantida.
 */
export function AppointmentDropZone({
  date,
  barberId,
  barberName,
  mode = "time",
  startHour = 0,
  hourHeight = 80,
  className,
  style,
  title,
  children,
}: {
  date: string;
  barberId?: string;
  barberName?: string;
  mode?: "time" | "day";
  startHour?: number;
  hourHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  children: React.ReactNode;
}) {
  const [hoverMinute, setHoverMinute] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState(false);
  const [proposal, setProposal] = useState<{ origin: DragSource; to: DropProposal } | null>(null);

  function minuteAt(event: React.DragEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const grab = currentDrag?.grabOffsetPx ?? 0;
    const raw = startHour * 60 + (event.clientY - rect.top - grab) / (hourHeight / 60);
    return Math.max(startHour * 60, Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES);
  }

  const accepts = (event: React.DragEvent) => currentDrag !== null && hasPayload(event);

  return (
    <div
      className={cn(className, mode === "day" && hoverDay && "ring-2 ring-inset ring-secondary")}
      style={style}
      title={title}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (mode === "time") {
          const minute = minuteAt(event);
          if (minute !== hoverMinute) setHoverMinute(minute);
        } else setHoverDay(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setHoverMinute(null);
        setHoverDay(false);
      }}
      onDrop={(event) => {
        if (!accepts(event) || !currentDrag) return;
        event.preventDefault();
        const { grabOffsetPx: _grab, ...origin } = currentDrag;
        void _grab;
        setProposal({
          origin,
          to: { date, time: mode === "time" ? minutesToHHMM(minuteAt(event)) : undefined, barberId, barberName },
        });
        setHoverMinute(null);
        setHoverDay(false);
      }}
    >
      {children}

      {mode === "time" && hoverMinute !== null && currentDrag && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed border-secondary bg-secondary/15 px-1 text-[10px] font-semibold text-foreground"
          style={{
            top: ((hoverMinute - startHour * 60) / 60) * hourHeight,
            height: Math.max(18, (currentDrag.durationMin / 60) * hourHeight),
          }}
        >
          {minutesToHHMM(hoverMinute)}–{minutesToHHMM(hoverMinute + currentDrag.durationMin)}
        </div>
      )}

      {proposal && <MoveConfirmDialog origin={proposal.origin} to={proposal.to} onClose={() => setProposal(null)} />}
    </div>
  );
}

function ModalShell({
  title,
  icon,
  pending,
  error,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  pending: boolean;
  error: string | null;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Portal no <body>: o diálogo nasce dentro de <tbody>/colunas com overflow, onde um <div> não pode ficar.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={pending ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-sm space-y-4 rounded-2xl border bg-[var(--background-elevated)] p-5 text-left shadow-xl">
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <p className="text-lg font-semibold">{title}</p>
        </div>
        {children}
        {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border px-3 py-1.5 text-sm text-foreground-muted hover:bg-[var(--surface-subtle-hover)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-xl bg-secondary-dark px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Line({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-[var(--surface-subtle)] p-2 text-sm text-foreground">
      <span className="font-medium">{name}</span>
      <span className="block text-xs text-foreground-muted">{children}</span>
    </p>
  );
}

function SwapConfirmDialog({ source, target, onClose }: { source: DragSource; target: DragSource; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await swapAppointmentsAction(source.id, target.id);
      if (result.ok) {
        toast.success(`Horários trocados: ${result.data?.firstName ?? source.customerName} ⇄ ${result.data?.secondName ?? target.customerName}.`);
        router.refresh();
        onClose();
      } else setError(result.error);
    });
  }

  return (
    <ModalShell
      title="Trocar horários?"
      icon={<ArrowLeftRight className="h-5 w-5 text-secondary-light" />}
      pending={pending}
      error={error}
      confirmLabel="Trocar horários"
      pendingLabel="Trocando..."
      onConfirm={confirm}
      onClose={onClose}
    >
      <div className="space-y-2">
        <Line name={source.customerName}>
          {source.timeLabel} · {source.barberName} <span className="text-foreground">→ {target.timeLabel} · {target.barberName}</span>
        </Line>
        <Line name={target.customerName}>
          {target.timeLabel} · {target.barberName} <span className="text-foreground">→ {source.timeLabel} · {source.barberName}</span>
        </Line>
      </div>
      <p className="text-xs text-foreground-muted">
        Cada cliente assume o horário (e o barbeiro) do outro, mantendo os próprios serviços e valor. Nada é cancelado.
      </p>
    </ModalShell>
  );
}

function MoveConfirmDialog({
  origin,
  to,
  askTime = false,
  onClose,
}: {
  origin: DragSource;
  to: DropProposal;
  /** No celular não há "posição na grade": o horário é escolhido aqui, num seletor (começa no horário atual). */
  askTime?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const currentTime = origin.timeLabel.match(/\d{2}:\d{2}/)?.[0] ?? "09:00";
  const [pickedTime, setPickedTime] = useState(currentTime);
  const time = to.time ?? (askTime ? pickedTime : undefined);

  const [year, month, day] = to.date.split("-");
  const dateLabel = `${day}/${month}/${year}`;
  const [h, m] = (time ?? "00:00").split(":").map(Number);
  const newRange = time ? `${time}–${minutesToHHMM(h * 60 + m + origin.durationMin)}` : null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await moveAppointmentAction({ appointmentId: origin.id, date: to.date, time, barberId: to.barberId });
      if (result.ok) {
        toast.success(`${origin.customerName} movido para ${dateLabel}${newRange ? ` às ${time}` : ""}.`);
        router.refresh();
        onClose();
      } else setError(result.error);
    });
  }

  return (
    <ModalShell
      title="Mudar horário?"
      icon={<CalendarClock className="h-5 w-5 text-secondary-light" />}
      pending={pending}
      error={error}
      confirmLabel="Mudar horário"
      pendingLabel="Movendo..."
      onConfirm={confirm}
      onClose={onClose}
    >
      <Line name={origin.customerName}>
        {origin.timeLabel} · {origin.barberName}
        <span className="block text-foreground">
          → {dateLabel}
          {newRange ? ` · ${newRange}` : " (mesmo horário)"}
          {to.barberName ? ` · ${to.barberName}` : ""}
        </span>
      </Line>
      {askTime && !to.time && (
        <label className="block space-y-1 text-sm text-foreground">
          Novo horário
          <input
            type="time"
            step={900}
            value={pickedTime}
            onChange={(event) => setPickedTime(event.target.value)}
            className="flex h-10 w-full rounded-xl border bg-[var(--surface-subtle)] px-3 text-sm text-foreground"
          />
        </label>
      )}
      <p className="text-xs text-foreground-muted">Os serviços, o valor e a duração continuam os mesmos. Nada é cancelado.</p>
    </ModalShell>
  );
}

/** Confirmação de "aumentar/diminuir o atendimento" (bolinha de baixo do bloco). */
export function ResizeConfirmDialog({
  source,
  startMinute,
  newDurationMin,
  onClose,
  onDone,
}: {
  source: DragSource;
  /** Início do atendimento, em minutos desde a meia-noite. */
  startMinute: number;
  newDurationMin: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m}min`;
  };

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await resizeAppointmentAction({ appointmentId: source.id, durationMin: newDurationMin });
      if (result.ok) {
        toast.success(`${source.customerName}: atendimento até ${result.data?.endLabel ?? minutesToHHMM(startMinute + newDurationMin)}.`);
        router.refresh();
        onDone();
      } else setError(result.error);
    });
  }

  return (
    <ModalShell
      title={newDurationMin > source.durationMin ? "Aumentar o atendimento?" : "Diminuir o atendimento?"}
      icon={<Timer className="h-5 w-5 text-secondary-light" />}
      pending={pending}
      error={error}
      confirmLabel="Confirmar"
      pendingLabel="Salvando..."
      onConfirm={confirm}
      onClose={onClose}
    >
      <Line name={source.customerName}>
        {minutesToHHMM(startMinute)}–{minutesToHHMM(startMinute + source.durationMin)} ({fmt(source.durationMin)})
        <span className="block text-foreground">
          → {minutesToHHMM(startMinute)}–{minutesToHHMM(startMinute + newDurationMin)} ({fmt(newDurationMin)})
        </span>
      </Line>
      <p className="text-xs text-foreground-muted">
        Pode passar do almoço ou do fim do expediente. Só não pode bater em outro cliente. Os serviços e o valor continuam os mesmos.
      </p>
    </ModalShell>
  );
}

/** BlockData -> o que o arrastar precisa saber do agendamento. */
export const blockToDragSource = (block: BlockData): DragSource => ({
  id: block.id,
  customerName: block.customerName,
  timeLabel: block.timeLabel,
  barberName: block.barberName,
  durationMin: block.durationMin,
});

/**
 * Soltou (com o dedo) um card em algum alvo: guarda a proposta e mostra a MESMA confirmação do
 * desktop. `sources` = todos os agendamentos arrastáveis na tela, pra achar origem e alvo pelo id.
 */
export function useTouchDropDialogs(sources: DragSource[]) {
  const byId = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const [pending, setPending] = useState<
    { kind: "swap"; source: DragSource; target: DragSource } | { kind: "move"; origin: DragSource; to: DropProposal } | null
  >(null);

  const onDrop = useCallback(
    (sourceId: string, target: TouchDropTarget) => {
      const origin = byId.get(sourceId);
      if (!origin) return;
      if (target.kind === "swap") {
        const other = byId.get(target.id);
        if (other) setPending({ kind: "swap", source: origin, target: other });
      } else {
        setPending({ kind: "move", origin, to: { date: target.date, time: target.time, barberId: target.barberId, barberName: target.barberName } });
      }
    },
    [byId]
  );

  const close = () => setPending(null);
  const dialog =
    pending?.kind === "swap" ? (
      <SwapConfirmDialog source={pending.source} target={pending.target} onClose={close} />
    ) : pending?.kind === "move" ? (
      <MoveConfirmDialog origin={pending.origin} to={pending.to} askTime onClose={close} />
    ) : null;
  return { onDrop, dialog };
}
