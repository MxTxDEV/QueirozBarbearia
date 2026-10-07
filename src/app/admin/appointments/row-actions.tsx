"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeDollarSign } from "lucide-react";
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
  recurring,
}: {
  id: string;
  status: AppointmentStatus;
  hasPayment?: boolean;
  /** Agendamento de uma recorrência: cancelar vale só pra este dia. */
  recurring?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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

  /** Conclui e já abre o registro do pagamento deste atendimento. */
  function completeAndCharge() {
    startTransition(async () => {
      try {
        await completeAppointmentAction(id);
        toast.success("Atendimento concluído — registre o pagamento.");
        router.push(`/admin/appointments/${id}/payment`);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  }

  const open = status === "PENDING" || status === "CONFIRMED";

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {open && (
        <Button type="button" size="sm" variant="accent" disabled={pending} onClick={completeAndCharge} title="Conclui o atendimento e já abre o pagamento">
          <BadgeDollarSign className="h-4 w-4" /> Concluir e receber
        </Button>
      )}
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
          onClick={() => {
            const message = recurring
              ? "Cancelar só este dia? A recorrência continua ativa — os outros dias seguem marcados."
              : "Cancelar esse agendamento? Essa ação não pode ser desfeita.";
            if (!confirm(message)) return;
            run(cancelAppointmentAdminAction, recurring ? "Dia cancelado — a recorrência continua ativa." : "Agendamento cancelado.");
          }}
        >
          {recurring ? "Cancelar só este dia" : "Cancelar"}
        </Button>
      )}
      {open && (
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
