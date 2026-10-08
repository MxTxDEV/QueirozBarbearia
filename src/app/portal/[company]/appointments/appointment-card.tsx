import { Repeat } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { describeFrequency } from "@/lib/recurring-helpers";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton } from "./cancel-button";
import { ConfirmButton } from "./confirm-button";
import type { getCustomerAgenda } from "@/lib/data/portal";

type Appt = Awaited<ReturnType<typeof getCustomerAgenda>>["upcoming"][number];

/** Um horário do cliente: dia/hora, barbeiro, serviços, se é de recorrência, se já confirmou — e as ações (só nos que ainda vão acontecer). */
export function PortalAppointmentCard({ appt, actionable }: { appt: Appt; actionable: boolean }) {
  const series = appt.recurringOccurrence?.recurringAppointment;
  const live = actionable && (appt.status === "PENDING" || appt.status === "CONFIRMED");

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">
            {formatDate(appt.appointmentDate)} às {formatTime(appt.startTime)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {series && (
              <Badge variant="accent">
                <Repeat className="mr-1 inline h-3 w-3" />
                Recorrência · {describeFrequency(series.frequencyUnit, series.intervalValue)}
              </Badge>
            )}
            <Badge variant={APPOINTMENT_STATUS_VARIANT[appt.status]}>{APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
          </div>
        </div>
        <p className="text-sm text-foreground-muted">Barbeiro: {appt.barber.name}</p>
        <p className="text-sm text-foreground-muted">{appt.services.map((s) => s.serviceName).join(", ")}</p>
        {appt.notes && <p className="text-sm italic text-foreground-muted">📝 {appt.notes}</p>}
        {live && appt.clientConfirmedAt && <p className="text-sm font-medium text-success">✅ Você confirmou este horário</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-secondary-light">{formatCurrency(appt.totalPrice.toString())}</span>
          {live && (
            <div className="flex flex-wrap items-start gap-2">
              {!appt.clientConfirmedAt && <ConfirmButton appointmentId={appt.id} />}
              <CancelButton appointmentId={appt.id} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
