"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Pencil, Repeat, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { updateAppointmentNotesAction } from "@/actions/appointments";
import { cn } from "@/lib/utils";
import { isMovableStatus, useAppointmentSwapDnd } from "./appointment-dnd";

export type BlockData = {
  id: string;
  /** Nulo = cliente avulso (sem cadastro) — não há perfil pra abrir. */
  customerId: string | null;
  customerName: string;
  /** Observação do agendamento (onde costuma ir o nome/detalhes de cliente avulso). */
  notes?: string | null;
  /** Faz parte de uma recorrência (série): id e descrição da frequência. */
  recurring?: { seriesId: string; label: string } | null;
  barberName: string;
  services: string;
  status: string;
  statusLabel: string;
  timeLabel: string;
  /** Duração em minutos — usada pra desenhar o "fantasma" ao arrastar pra outro horário. */
  durationMin: number;
  price: string;
  /** Quando o cliente confirmou pelo link do WhatsApp (ISO); nulo = ainda não confirmou. */
  clientConfirmedAt?: string | null;
};

/** Cor da faixa por status — segue a mesma semântica dos badges do sistema. */
const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-l-warning bg-warning/[0.12] hover:bg-warning/[0.18]",
  CONFIRMED: "border-l-accent-light bg-accent/[0.14] hover:bg-accent/[0.2]",
  COMPLETED: "border-l-success bg-success/[0.12] hover:bg-success/[0.18]",
  CANCELLED: "border-l-danger bg-danger/[0.1] hover:bg-danger/[0.16]",
  NO_SHOW: "border-l-foreground-muted bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle-hover)]",
};

/**
 * Bloco de agendamento na grade. Ao clicar, abre um painel com os detalhes
 * e as MESMAS ações da lista (recebidas como `actions`, renderizadas no
 * servidor) — nenhuma regra de negócio é reimplementada aqui.
 */
export function AppointmentBlock({
  data,
  actions,
  style,
  compact = false,
  dense = false,
}: {
  data: BlockData;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
  /** Item de lista (visão de mês) em vez de bloco posicionado na grade. */
  compact?: boolean;
  /** Bloco curto demais para duas linhas — mostra só a linha principal. */
  dense?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cancelled = data.status === "CANCELLED" || data.status === "NO_SHOW";
  // Só pendente/confirmado se arrasta (trocar de horário) — concluído, cancelado e falta já aconteceram.
  const movable = isMovableStatus(data.status);
  const { dragging, dragOver, handlers, dialog } = useAppointmentSwapDnd(
    { id: data.id, customerName: data.customerName, timeLabel: data.timeLabel, barberName: data.barberName, durationMin: data.durationMin },
    movable
  );

  return (
    <>
      {/* div[role=button] e não <button>: o Firefox não deixa arrastar <button>. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        {...handlers}
        style={style}
        aria-label={`${data.timeLabel} — ${data.customerName}, ${data.statusLabel}`}
        title={movable ? "Arraste sobre outro cliente para trocar, ou para um horário livre para mudar" : undefined}
        className={cn(
          "group overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60",
          STATUS_STYLE[data.status] ?? STATUS_STYLE.NO_SHOW,
          cancelled && "opacity-60",
          movable && "cursor-grab active:cursor-grabbing",
          dragging && "opacity-40",
          dragOver && "z-20 scale-[1.03] ring-2 ring-secondary",
          compact ? "w-full" : "absolute"
        )}
      >
        <p className={cn("flex items-center gap-1 truncate text-[11px] font-semibold text-foreground", cancelled && "line-through")}>
          {data.recurring && <Repeat className="h-3 w-3 shrink-0 text-secondary-light" aria-label="Recorrente" />}
          {data.clientConfirmedAt && <BadgeCheck className="h-3 w-3 shrink-0 text-success" aria-label="Cliente confirmou" />}
          <span className="truncate">
            {data.timeLabel} {data.customerName}
          </span>
          {data.notes && dense && <span className="truncate font-normal italic text-foreground-muted">· {data.notes}</span>}
        </p>
        {!compact && !dense && (
          <p className="truncate text-[10px] text-foreground-muted">
            {data.services} · {data.barberName}
          </p>
        )}
        {data.notes && !dense && (
          <p className="flex items-center gap-1 truncate text-[10px] italic text-foreground">
            <StickyNote className="h-2.5 w-2.5 shrink-0 text-secondary-light" aria-hidden />
            <span className="truncate">{data.notes}</span>
          </p>
        )}
      </div>

      {dialog}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="glass-strong relative z-10 w-full max-w-sm rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">{data.customerName}</p>
                <p className="text-sm text-foreground-muted">{data.timeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label="Serviços" value={data.services} />
              <Row label="Barbeiro" value={data.barberName} />
              <Row label="Valor" value={data.price} />
              <Row label="Status" value={data.statusLabel} />
              {(data.status === "PENDING" || data.status === "CONFIRMED") && (
                <Row
                  label="Cliente"
                  value={
                    data.clientConfirmedAt
                      ? `✅ Confirmou em ${new Date(data.clientConfirmedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
                      : "Ainda não confirmou pelo link"
                  }
                />
              )}
              {data.recurring && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-foreground-muted">Recorrência</dt>
                  <dd className="text-right text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="h-3 w-3 text-secondary-light" /> {data.recurring.label}
                    </span>
                    <Link href={`/admin/recurring-appointments/${data.recurring.seriesId}`} className="block text-xs text-secondary-light hover:underline">
                      Ver recorrência
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            <NotesEditor appointmentId={data.id} notes={data.notes ?? ""} />

            {actions && <div className="mt-4 border-t pt-4">{actions}</div>}

            {data.customerId ? (
              <Link
                href={`/admin/customers/${data.customerId}`}
                className="mt-4 inline-block text-sm text-secondary-light hover:underline"
              >
                Ver perfil do cliente
              </Link>
            ) : (
              <p className="mt-4 text-xs text-foreground-muted">Cliente avulso — sem cadastro.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-foreground-muted">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

/** Observação do agendamento, editável na hora (ex: o nome do filho quando só o pai tem cadastro). */
function NotesEditor({ appointmentId, notes }: { appointmentId: string; notes: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateAppointmentNotesAction(appointmentId, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Observação salva.");
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-3 rounded-xl border bg-[var(--surface-subtle)] p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-foreground-muted">
            <StickyNote className="h-3.5 w-3.5" /> Observação
          </span>
          <button type="button" onClick={() => { setValue(notes); setEditing(true); }} className="flex items-center gap-1 text-xs text-secondary-light hover:underline">
            <Pencil className="h-3 w-3" /> {notes ? "Editar" : "Adicionar"}
          </button>
        </div>
        {notes && <p className="mt-1 whitespace-pre-wrap text-foreground">{notes}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border bg-[var(--surface-subtle)] p-3">
      <label htmlFor={`notes-${appointmentId}`} className="text-sm text-foreground-muted">Observação</label>
      <textarea
        id={`notes-${appointmentId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        maxLength={500}
        autoFocus
        placeholder="Ex.: corte do filho Pedro"
        className="w-full rounded-lg border bg-transparent p-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="rounded-lg px-3 py-1 text-xs text-foreground-muted hover:bg-[var(--surface-subtle-hover)]">
          Cancelar
        </button>
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-secondary px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
