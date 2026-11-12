import { notFound } from "next/navigation";
import { getAppointmentDetail } from "@/lib/data/appointments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toNumber } from "@/lib/serialize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminContext } from "@/lib/require-admin";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { appointmentClientName } from "@/lib/appointment-client";
import { EditPaymentForm } from "./edit-payment-form";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const appointment = await getAppointmentDetail(id, user.companyId);
  if (!appointment || appointment.payments.length === 0) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Breadcrumb
        items={[
          { label: "Agendamentos", href: "/admin/appointments" },
          { label: appointmentClientName(appointment) },
          { label: "Editar pagamento" },
        ]}
      />
      <h1 className="text-2xl font-semibold text-foreground">Editar pagamento</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            {appointmentClientName(appointment)} — {formatDate(appointment.appointmentDate)}
          </CardTitle>
          <p className="text-sm text-foreground-muted">
            {appointment.services.map((s) => s.serviceName).join(", ")} · Valor do agendamento: {formatCurrency(toNumber(appointment.totalPrice))}
          </p>
        </CardHeader>
        <CardContent>
          <EditPaymentForm
            appointmentId={id}
            payments={appointment.payments
              .slice()
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
              .map((p) => ({ id: p.id, amount: toNumber(p.amount), paymentMethod: p.paymentMethod, paidAt: p.paidAt.toISOString().slice(0, 10) }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
