"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  pauseRecurringAppointmentAsCustomerAction,
  resumeRecurringAppointmentAsCustomerAction,
  cancelRecurringAppointmentAsCustomerAction,
} from "@/actions/recurring-appointments";
import type { RecurringAppointmentStatus } from "@prisma/client";

export function RecurringSeriesActions({ id, status }: { id: string; status: RecurringAppointmentStatus }) {
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  function pause() {
    startTransition(async () => {
      const result = await pauseRecurringAppointmentAsCustomerAction(id);
      if (result.ok) {
        toast.success("Recorrência pausada.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function resume() {
    startTransition(async () => {
      const result = await resumeRecurringAppointmentAsCustomerAction(id);
      if (result.ok) {
        toast.success("Recorrência retomada.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function cancel(alsoCancelFutureAppointments: boolean) {
    const msg = alsoCancelFutureAppointments
      ? "Cancelar a recorrência e todos os agendamentos futuros já confirmados?"
      : "Cancelar a recorrência? Os agendamentos futuros já confirmados serão mantidos.";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const result = await cancelRecurringAppointmentAsCustomerAction(id, alsoCancelFutureAppointments);
      if (result.ok) {
        toast.success("Recorrência cancelada.");
        setCancelling(false);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (status !== "ACTIVE" && status !== "PAUSED") return null;

  if (cancelling) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-foreground-muted">Cancelar recorrência:</span>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => cancel(false)}>
          Manter agendamentos futuros
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => cancel(true)}>
          Cancelar tudo
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
          Pausar
        </Button>
      )}
      {status === "PAUSED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={resume}>
          Retomar
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setCancelling(true)}>
        Cancelar recorrência
      </Button>
    </div>
  );
}
