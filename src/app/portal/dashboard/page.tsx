import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireCompleteCustomerProfile } from "@/lib/require-customer";
import { getCustomerNextAppointment } from "@/lib/data/portal";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";

export default async function PortalDashboardPage() {
  const customer = await requireCompleteCustomerProfile();
  const next = await getCustomerNextAppointment(customer.id, customer.companyId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Olá, {customer.fullName.split(" ")[0]}!</h1>
        <p className="text-sm text-foreground-muted">Bem-vindo ao seu portal Barber Pro.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximo agendamento</CardTitle>
        </CardHeader>
        <CardContent>
          {!next && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-foreground-muted">Você ainda não tem nenhum horário agendado.</p>
              <Link href="/portal/book">
                <Button>
                  <CalendarPlus className="h-4 w-4" /> Agendar agora
                </Button>
              </Link>
            </div>
          )}
          {next && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-foreground">
                  {formatDate(next.appointmentDate)} às {formatTime(next.startTime)}
                </p>
                <Badge variant={APPOINTMENT_STATUS_VARIANT[next.status]}>{APPOINTMENT_STATUS_LABEL[next.status]}</Badge>
              </div>
              <p className="text-sm text-foreground-muted">Barbeiro: {next.barber.name}</p>
              <p className="text-sm text-foreground-muted">
                Serviços: {next.services.map((s) => s.serviceName).join(", ")}
              </p>
              <p className="text-sm font-medium text-secondary-light">{formatCurrency(next.totalPrice.toString())}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Link href="/portal/book">
        <Button className="w-full" size="lg">
          <CalendarPlus className="h-4 w-4" /> Novo agendamento
        </Button>
      </Link>
    </div>
  );
}
