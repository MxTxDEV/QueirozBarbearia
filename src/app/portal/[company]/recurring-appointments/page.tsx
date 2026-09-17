import { requireCompleteCustomerProfile } from "@/lib/require-customer";
import { listRecurringAppointmentsForCustomer } from "@/lib/data/recurring";
import { formatDate, formatTime } from "@/lib/utils";
import { RECURRING_STATUS_LABEL, RECURRING_STATUS_VARIANT } from "@/lib/labels";
import { describeFrequency } from "@/lib/recurring-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecurringSeriesActions } from "./recurring-series-actions";

export default async function PortalRecurringAppointmentsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const customer = await requireCompleteCustomerProfile(slug);
  const series = await listRecurringAppointmentsForCustomer(customer.id, customer.companyId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Minhas recorrências</h1>
        <p className="text-sm text-foreground-muted">Atendimentos que se repetem automaticamente com o mesmo barbeiro.</p>
      </div>

      <div className="space-y-3">
        {series.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-foreground-muted">
              Nenhuma recorrência ainda. Ative &quot;Repetir este agendamento&quot; ao agendar um horário.
            </CardContent>
          </Card>
        )}
        {series.map((s) => {
          const next = s.occurrences[0];
          return (
            <Card key={s.id}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{s.service.name}</p>
                  <Badge variant={RECURRING_STATUS_VARIANT[s.status]}>{RECURRING_STATUS_LABEL[s.status]}</Badge>
                </div>
                <p className="text-sm text-foreground-muted">Barbeiro: {s.barber.name}</p>
                <p className="text-sm text-foreground-muted">
                  {describeFrequency(s.frequencyUnit, s.intervalValue)} às {s.startTime}
                </p>
                {s.status === "PENDING_APPROVAL" && (
                  <p className="text-sm text-warning">
                    Sua solicitação de recorrência foi enviada ao barbeiro e aguarda confirmação.
                  </p>
                )}
                {next && (
                  <p className="text-sm text-foreground-muted">
                    Próximo: {formatDate(next.scheduledDate)} às {formatTime(next.scheduledStartTime)}
                  </p>
                )}
                {s.rejectionReason && <p className="text-sm text-danger">Motivo da recusa: {s.rejectionReason}</p>}
                <RecurringSeriesActions id={s.id} status={s.status} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
