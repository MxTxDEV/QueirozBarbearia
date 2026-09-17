"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Lock, Clock, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveRecurringAppointmentAction, rejectRecurringAppointmentAction } from "@/actions/recurring-appointments";
import type { OccurrencePreviewStatus } from "@/lib/recurring-engine";

type PreviewRow = { occurrenceId: string; dateLabel: string; timeLabel: string; status: OccurrencePreviewStatus };

const STATUS_ICON: Record<OccurrencePreviewStatus, React.ReactNode> = {
  AVAILABLE: <CheckCircle2 className="h-4 w-4 text-success" />,
  APPOINTMENT_CONFLICT: <AlertTriangle className="h-4 w-4 text-danger" />,
  BLOCKED: <Lock className="h-4 w-4 text-danger" />,
  HOLD_CONFLICT: <Clock className="h-4 w-4 text-warning" />,
  OUTSIDE_WORKING_HOURS: <CalendarOff className="h-4 w-4 text-danger" />,
};
const STATUS_LABEL: Record<OccurrencePreviewStatus, string> = {
  AVAILABLE: "Disponível",
  APPOINTMENT_CONFLICT: "Conflito com agendamento",
  BLOCKED: "Bloqueado",
  HOLD_CONFLICT: "Reservado (HOLD ativo)",
  OUTSIDE_WORKING_HOURS: "Fora do horário de funcionamento",
};

export function ApprovalPanel({ seriesId, rows }: { seriesId: string; rows: PreviewRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(rows.filter((r) => r.status === "AVAILABLE").map((r) => r.occurrenceId)));
  const [enrollWaitlist, setEnrollWaitlist] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function approve(mode: "selected" | "all") {
    startTransition(async () => {
      const result = await approveRecurringAppointmentAction(seriesId, {
        occurrenceIds: mode === "selected" ? Array.from(selected) : null,
        enrollConflictsInWaitlist: enrollWaitlist,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data!.confirmedCount} confirmado(s), ${result.data!.conflictCount + result.data!.waitingListCount} indisponível(is).`);
      router.push("/admin/recurring-appointments");
    });
  }

  function reject() {
    if (reason.trim().length < 3) {
      toast.error("Informe o motivo da recusa.");
      return;
    }
    startTransition(async () => {
      const result = await rejectRecurringAppointmentAction(seriesId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Recorrência recusada.");
      router.push("/admin/recurring-appointments");
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rows.map((row) => (
          <label
            key={row.occurrenceId}
            className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(row.occurrenceId)}
                onChange={() => toggle(row.occurrenceId)}
                className="h-4 w-4"
              />
              <span className="text-foreground">
                {row.dateLabel} {row.timeLabel}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
              {STATUS_ICON[row.status]} {STATUS_LABEL[row.status]}
            </span>
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground-muted">
        <input type="checkbox" checked={enrollWaitlist} onChange={(e) => setEnrollWaitlist(e.target.checked)} className="h-4 w-4" />
        Colocar as indisponíveis na lista de espera automaticamente
      </label>

      {rejecting ? (
        <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
          <label className="text-sm font-medium text-foreground">Motivo da recusa</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border bg-[var(--surface-subtle)] p-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending} onClick={reject}>
              Confirmar recusa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || selected.size === 0} onClick={() => approve("selected")}>
            Aprovar selecionadas ({selected.size})
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => approve("all")}>
            Aprovar todas
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
            Recusar
          </Button>
        </div>
      )}
    </div>
  );
}
