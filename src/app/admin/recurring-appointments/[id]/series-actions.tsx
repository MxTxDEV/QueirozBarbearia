"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminPauseRecurringAppointmentAction,
  adminResumeRecurringAppointmentAction,
  adminCancelRecurringAppointmentAction,
} from "@/actions/recurring-appointments";
import type { RecurringAppointmentStatus } from "@prisma/client";

export function AdminSeriesActions({ id, status }: { id: string; status: RecurringAppointmentStatus }) {
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  function pause() {
    startTransition(async () => {
      const result = await adminPauseRecurringAppointmentAction(id);
      if (result.ok) {
        toast.success("Recorrência pausada.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function resume() {
    startTransition(async () => {
      const result = await adminResumeRecurringAppointmentAction(id);
      if (result.ok) {
        toast.success("Recorrência retomada.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function cancel(alsoCancelFutureAppointments: boolean) {
    startTransition(async () => {
      const result = await adminCancelRecurringAppointmentAction(id, alsoCancelFutureAppointments);
      if (result.ok) {
        toast.success("Recorrência cancelada.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (status !== "ACTIVE" && status !== "PAUSED") return null;

  if (cancelling) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">
        <span className="text-foreground-muted">Cancelar recorrência:</span>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => cancel(false)}>
          Manter agendamentos futuros
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => cancel(true)}>
          Cancelar recorrência e futuros
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={pause}>
          Pausar recorrência
        </Button>
      )}
      {status === "PAUSED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={resume}>
          Retomar recorrência
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setCancelling(true)}>
        Cancelar recorrência
      </Button>
    </div>
  );
}
