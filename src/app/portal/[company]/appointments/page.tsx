import { requireCompleteCustomerProfile } from "@/lib/require-customer";
import { listCustomerAppointments } from "@/lib/data/portal";
import { listActiveWaitlistEntriesForCustomer } from "@/lib/data/waitlist";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT, WAITLIST_STATUS_LABEL, WAITLIST_STATUS_VARIANT } from "@/lib/labels";
import { AutoRefresh } from "@/components/auto-refresh";
import { CancelButton } from "./cancel-button";
import { WaitlistEntryActions } from "./waitlist-entry-actions";

export default async function PortalAppointmentsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const customer = await requireCompleteCustomerProfile(slug);
  const [appointments, waitlistEntries] = await Promise.all([
    listCustomerAppointments(customer.id, customer.companyId),
    listActiveWaitlistEntriesForCustomer(customer.companyId, customer.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Atualiza a cada 15s — é assim que a contagem do prazo de confirmação de uma oferta se mantém em dia sem polling próprio. */}
      <AutoRefresh />
      <h1 className="text-2xl font-semibold text-foreground">Meus agendamentos</h1>

      {waitlistEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground-muted">Minha lista de espera</h2>
          {waitlistEntries.map((entry) => {
            const holdActive = entry.status === "OFFERED" && entry.holdExpiresAt !== null && entry.holdExpiresAt > new Date();
            return (
              <Card key={entry.id} className={holdActive ? "ring-2 ring-secondary" : undefined}>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{entry.service.name}</p>
                    <Badge variant={WAITLIST_STATUS_VARIANT[entry.status]}>{WAITLIST_STATUS_LABEL[entry.status]}</Badge>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    Preferência: {formatDate(entry.date)} às {formatTime(entry.preferredTime)} (±{entry.toleranceMinutes}min) ·{" "}
                    {entry.barber ? entry.barber.name : "Qualquer barbeiro"}
                  </p>
                  {holdActive && entry.offeredStartTime && entry.offeredBarber && (
                    <p className="text-sm font-medium text-secondary-light">
                      Vaga disponível: {formatDate(entry.offeredStartTime)} às {formatTime(entry.offeredStartTime)} com{" "}
                      {entry.offeredBarber.name} — confirme até {formatTime(entry.holdExpiresAt!)}.
                    </p>
                  )}
                  <WaitlistEntryActions entryId={entry.id} canConfirm={holdActive} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {appointments.length === 0 && waitlistEntries.length === 0 && (
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
