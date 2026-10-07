"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Janela de confirmação/edição. Vai pro <body> (portal) — dentro de tabela ou de coluna com overflow
 * um <div> não pode ficar — com painel opaco (o vidro translúcido do tema deixa o texto ilegível).
 * Fecha com Esc ou clicando fora (a menos que `busy`, enquanto grava).
 */
export function Modal({
  title,
  icon,
  onClose,
  busy = false,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : onClose} />
      <div className={cn("relative z-10 w-full max-w-md space-y-4 rounded-2xl border bg-[var(--background-elevated)] p-5 text-left shadow-xl", className)}>
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <p className="text-lg font-semibold">{title}</p>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
