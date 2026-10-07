import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireCompleteCustomerProfile, resolvePortalCompany } from "@/lib/require-customer";
import { getCustomerAgenda } from "@/lib/data/portal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalAppointmentCard } from "../appointments/appointment-card";

export default async function PortalDashboardPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const [customer, company] = await Promise.all([requireCompleteCustomerProfile(slug), resolvePortalCompany(slug)]);
  const { upcoming } = await getCustomerAgenda(customer.id, customer.companyId);
  const shown = upcoming.slice(0, 5);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Olá, {customer.fullName.split(" ")[0]}!</h1>
        <p className="text-sm text-foreground-muted">Bem-vindo ao seu espaço na {company.name}.</p>
      </div>

      <section className="space-y-3" aria-label="Seus próximos horários">
        <h2 className="text-sm font-semibold text-foreground-muted">
          {upcoming.length === 0 ? "Seus horários" : upcoming.length === 1 ? "Seu próximo horário" : `Seus próximos horários (${upcoming.length})`}
        </h2>
        {upcoming.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-foreground-muted">Você ainda não tem nenhum horário agendado.</p>
              <Link href={`/portal/${slug}/book`}>
                <Button>
                  <CalendarPlus className="h-4 w-4" /> Agendar agora
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {shown.map((appt) => (
          <PortalAppointmentCard key={appt.id} appt={appt} actionable />
        ))}
        {upcoming.length > shown.length && (
          <Link href={`/portal/${slug}/appointments`} className="block text-center text-sm text-secondary-light hover:underline">
            Ver todos os {upcoming.length} horários (inclui as datas da recorrência)
          </Link>
        )}
      </section>

      <Link href={`/portal/${slug}/book`}>
        <Button className="w-full" size="lg">
          <CalendarPlus className="h-4 w-4" /> Novo agendamento
        </Button>
      </Link>
    </div>
  );
}
