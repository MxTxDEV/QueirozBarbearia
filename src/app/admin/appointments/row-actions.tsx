"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cancelAppointmentAdminAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  markNoShowAction,
} from "@/actions/appointments";
import type { AppointmentStatus } from "@prisma/client";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação. Tente novamente.";
}

export function AppointmentRowActions({
  id,
  status,
  hasPayment,
}: {
  id: string;
  status: AppointmentStatus;
  hasPayment?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action(id);
        toast.success(successMessage);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {status === "PENDING" && (
        <Button type="button" size="sm" disabled={pending} onClick={() => run(confirmAppointmentAction, "Agendamento confirmado.")}>
          Confirmar
        </Button>
      )}
      {(status === "PENDING" || status === "CONFIRMED") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(cancelAppointmentAdminAction, "Agendamento cancelado.")}
        >
          Cancelar
        </Button>
      )}
      {status === "CONFIRMED" && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => run(completeAppointmentAction, "Agendamento concluído.")}
        >
          Concluir
        </Button>
      )}
      {status === "CONFIRMED" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(markNoShowAction, "Marcado como não compareceu.")}
        >
          Não compareceu
        </Button>
      )}
      {status === "COMPLETED" && !hasPayment && (
        <Link href={`/admin/appointments/${id}/payment`}>
          <Button size="sm" variant="accent">
            Registrar pagamento
          </Button>
        </Link>
      )}
      {status === "COMPLETED" && hasPayment && <Badge variant="success">Pago</Badge>}
    </div>
  );
}
