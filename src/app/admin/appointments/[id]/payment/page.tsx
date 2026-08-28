import { notFound } from "next/navigation";
import { getAppointmentDetail } from "@/lib/data/appointments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toNumber } from "@/lib/serialize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentForm } from "./payment-form";
import { requireAdminContext } from "@/lib/require-admin";

export default async function RegisterPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const appointment = await getAppointmentDetail(id, user.companyId);
  if (!appointment) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Registrar pagamento</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            {appointment.customer.fullName} — {formatDate(appointment.appointmentDate)}
          </CardTitle>
          <p className="text-sm text-foreground-muted">
            {appointment.services.map((s) => s.serviceName).join(", ")} · Valor do agendamento:{" "}
            {formatCurrency(toNumber(appointment.totalPrice))}
          </p>
        </CardHeader>
        <CardContent>
          <PaymentForm appointmentId={id} defaultAmount={toNumber(appointment.totalPrice)} />
        </CardContent>
      </Card>
    </div>
  );
}
