import { requireCompleteCustomerProfile } from "@/lib/require-customer";
import { listCustomerAppointments } from "@/lib/data/portal";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { CancelButton } from "./cancel-button";

export default async function PortalAppointmentsPage() {
  const customer = await requireCompleteCustomerProfile();
  const appointments = await listCustomerAppointments(customer.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Meus agendamentos</h1>

      <div className="space-y-3">
        {appointments.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-foreground-muted">Nenhum agendamento ainda.</CardContent>
          </Card>
        )}
        {appointments.map((appt) => {
          const cancellable = appt.status === "PENDING" || appt.status === "CONFIRMED";
          return (
            <Card key={appt.id}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
                    {formatDate(appt.appointmentDate)} às {formatTime(appt.startTime)}
                  </p>
                  <Badge variant={APPOINTMENT_STATUS_VARIANT[appt.status]}>{APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
                </div>
                <p className="text-sm text-foreground-muted">Barbeiro: {appt.barber.name}</p>
                <p className="text-sm text-foreground-muted">
                  {appt.services.map((s) => s.serviceName).join(", ")}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary-light">
                    {formatCurrency(appt.totalPrice.toString())}
                  </span>
                  {cancellable && <CancelButton appointmentId={appt.id} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
