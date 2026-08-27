import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cancelAppointmentAdminAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  markNoShowAction,
} from "@/actions/appointments";
import type { AppointmentStatus } from "@prisma/client";

export function AppointmentRowActions({
  id,
  status,
  hasPayment,
}: {
  id: string;
  status: AppointmentStatus;
  hasPayment?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {status === "PENDING" && (
        <form action={confirmAppointmentAction.bind(null, id)}>
          <Button type="submit" size="sm">
            Confirmar
          </Button>
        </form>
      )}
      {(status === "PENDING" || status === "CONFIRMED") && (
        <form action={cancelAppointmentAdminAction.bind(null, id)}>
          <Button type="submit" size="sm" variant="outline">
            Cancelar
          </Button>
        </form>
      )}
      {status === "CONFIRMED" && (
        <form action={completeAppointmentAction.bind(null, id)}>
          <Button type="submit" size="sm" variant="secondary">
            Concluir
          </Button>
        </form>
      )}
      {status === "CONFIRMED" && (
        <form action={markNoShowAction.bind(null, id)}>
          <Button type="submit" size="sm" variant="ghost">
            Não compareceu
          </Button>
        </form>
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
