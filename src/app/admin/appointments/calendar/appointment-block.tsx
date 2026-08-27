"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type BlockData = {
  id: string;
  customerId: string;
  customerName: string;
  barberName: string;
  services: string;
  status: string;
  statusLabel: string;
  timeLabel: string;
  price: string;
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={style}
        aria-label={`${data.timeLabel} — ${data.customerName}, ${data.statusLabel}`}
        className={cn(
          "group overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60",
          STATUS_STYLE[data.status] ?? STATUS_STYLE.NO_SHOW,
          cancelled && "opacity-60",
          compact ? "w-full" : "absolute"
        )}
      >
        <p className={cn("truncate text-[11px] font-semibold text-foreground", cancelled && "line-through")}>
          {data.timeLabel} {data.customerName}
        </p>
        {!compact && !dense && (
          <p className="truncate text-[10px] text-foreground-muted">
            {data.services} · {data.barberName}
          </p>
        )}
      </button>

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
            </dl>

            {actions && <div className="mt-4 border-t pt-4">{actions}</div>}

            <Link
              href={`/admin/customers/${data.customerId}`}
              className="mt-4 inline-block text-sm text-secondary-light hover:underline"
            >
              Ver perfil do cliente
            </Link>
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
