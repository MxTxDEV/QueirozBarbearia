import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerProfile } from "@/lib/data/customers";
import { requireAdminContext } from "@/lib/require-admin";
import { formatCurrency, formatDate, formatWhatsappDisplay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageForm } from "./message-form";
import { DeleteCustomerButton } from "./delete-customer-button";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const profile = await getCustomerProfile(id, user.companyId);
  if (!profile) notFound();

  const { customer, clv, avgTicket, visits, lastVisit, preferredBarber, topServices } = profile;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Clientes", href: "/admin/customers" }, { label: customer.fullName }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{customer.fullName}</h1>
          <p className="text-sm text-foreground-muted">{formatWhatsappDisplay(customer.whatsapp)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/admin/customers/${id}/edit`}>
            <Button variant="secondary">Editar cadastro</Button>
          </Link>
          {user.role === "ADMIN" && <DeleteCustomerButton customerId={id} customerName={customer.fullName} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total gasto (CLV)</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{formatCurrency(clv)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ticket médio</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{formatCurrency(avgTicket)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Visitas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{visits}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Última visita</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className="text-base">{lastVisit ? formatDate(lastVisit) : "—"}</CardValue>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de agendamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.appointments.length === 0 && (
                <p className="text-sm text-foreground-muted">Nenhum agendamento ainda.</p>
              )}
              {customer.appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(appt.appointmentDate)} — {appt.barber.name}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {appt.services.map((s) => s.serviceName).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-foreground-muted">{formatCurrency(appt.totalPrice.toString())}</span>
                    <Badge variant={APPOINTMENT_STATUS_VARIANT[appt.status]}>{APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-foreground-muted">
                Barbeiro preferido: <span className="text-foreground">{preferredBarber ?? "—"}</span>
              </p>
              <p className="text-foreground-muted">Serviços mais utilizados:</p>
              <ul className="list-inside list-disc text-foreground">
                {topServices.length === 0 && <li className="text-foreground-muted">—</li>}
                {topServices.map((s) => (
                  <li key={s.name}>
                    {s.name} ({s.count}x)
                  </li>
                ))}
              </ul>
              {customer.notes && (
                <p className="mt-2 rounded-lg bg-[var(--surface-subtle)] p-2 text-xs text-foreground-muted">{customer.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enviar mensagem pelo WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageForm customerId={customer.id} phone={formatWhatsappDisplay(customer.whatsapp)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
