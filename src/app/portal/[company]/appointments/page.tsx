import { requireCompleteCustomerProfile } from "@/lib/require-customer";
import Link from "next/link";
import { getCustomerAgenda } from "@/lib/data/portal";
import { listRecurringAppointmentsForCustomer } from "@/lib/data/recurring";
import { describeFrequency } from "@/lib/recurring-helpers";
import { listActiveWaitlistEntriesForCustomer } from "@/lib/data/waitlist";
import { formatDate, formatTime, formatWhatsappDisplay } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RECURRING_STATUS_LABEL, RECURRING_STATUS_VARIANT, WAITLIST_STATUS_LABEL, WAITLIST_STATUS_VARIANT } from "@/lib/labels";
import { AutoRefresh } from "@/components/auto-refresh";
import { PortalAppointmentCard } from "./appointment-card";
import { WaitlistEntryActions } from "./waitlist-entry-actions";

export default async function PortalAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { company: slug } = await params;
  const { success } = await searchParams;
  const customer = await requireCompleteCustomerProfile(slug);
  const [{ upcoming, history }, series, waitlistEntries] = await Promise.all([
    getCustomerAgenda(customer.id, customer.companyId),
    listRecurringAppointmentsForCustomer(customer.id, customer.companyId),
    listActiveWaitlistEntriesForCustomer(customer.companyId, customer.id),
  ]);

  const activeSeries = series.filter((s) => s.status === "ACTIVE" || s.status === "PAUSED" || s.status === "PENDING_APPROVAL");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Atualiza a cada 15s — é assim que a contagem do prazo de confirmação de uma oferta se mantém em dia sem polling próprio. */}
      <AutoRefresh />
      <h1 className="text-2xl font-semibold text-foreground">Meus agendamentos</h1>

      {success === "1" && (
        <div role="status" className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-foreground">
          <p className="font-medium">Agendamento solicitado! ✅</p>
          <p className="mt-1 text-foreground-muted">
            Vamos avisar no seu WhatsApp ({formatWhatsappDisplay(customer.whatsapp)}) com um <strong className="text-foreground">link para confirmar o horário</strong>{" "}
            antes do atendimento.
          </p>
        </div>
      )}

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

      <section className="space-y-3" aria-label="Próximos horários">
        <h2 className="text-sm font-semibold text-foreground-muted">Próximos horários ({upcoming.length})</h2>
        {upcoming.length === 0 && (
          <Card>
            <CardContent className="space-y-3 text-center text-sm text-foreground-muted">
              <p>Você não tem nenhum horário marcado.</p>
              <Link href={`/portal/${slug}/book`} className="inline-block text-secondary-light hover:underline">
                Agendar agora
              </Link>
            </CardContent>
          </Card>
        )}
        {upcoming.map((appt) => (
          <PortalAppointmentCard key={appt.id} appt={appt} actionable />
        ))}
      </section>

      {activeSeries.length > 0 && (
        <section className="space-y-3" aria-label="Minhas recorrências">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground-muted">Minhas recorrências</h2>
            <Link href={`/portal/${slug}/recurring-appointments`} className="text-xs text-secondary-light hover:underline">
              Gerenciar
            </Link>
          </div>
          {activeSeries.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{s.service.name}</p>
                  <p className="text-sm text-foreground-muted">
                    {describeFrequency(s.frequencyUnit, s.intervalValue)} às {s.startTime} · {s.barber.name}
                  </p>
                </div>
                <Badge variant={RECURRING_STATUS_VARIANT[s.status]}>{RECURRING_STATUS_LABEL[s.status]}</Badge>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-foreground-muted">As datas de cada recorrência aparecem na lista de próximos horários acima.</p>
        </section>
      )}

      {history.length > 0 && (
        <details className="group space-y-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground-muted hover:text-foreground">
            Histórico ({history.length}) <span className="text-xs font-normal text-secondary-light group-open:hidden">— mostrar</span>
          </summary>
          <div className="mt-3 space-y-3">
            {history.map((appt) => (
              <PortalAppointmentCard key={appt.id} appt={appt} actionable={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
