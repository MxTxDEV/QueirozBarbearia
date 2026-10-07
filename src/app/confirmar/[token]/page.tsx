import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Scissors, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { shopNow } from "@/lib/shop-time";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyUnavailable } from "@/components/company-unavailable";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmPanel } from "./confirm-panel";

// Link pessoal enviado por WhatsApp: nunca deve aparecer em busca nem em cache compartilhado.
export const metadata: Metadata = { title: "Confirmar horário", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,64}$/;

function Message({ title, text, bookHref }: { title: string; text: string; bookHref?: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardContent className="space-y-2 py-8 text-center">
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm text-foreground-muted">{text}</p>
          {bookHref && (
            <a href={bookHref} className="inline-block text-sm text-secondary-light hover:underline">
              Agendar outro horário
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ConfirmAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_FORMAT.test(token)) notFound();

  const appt = await prisma.appointment.findUnique({
    where: { confirmToken: token },
    include: { barber: true, services: true, customer: true, company: { select: { name: true, slug: true, logoUrl: true, status: true } } },
  });
  if (!appt) notFound();

  if (appt.company.status !== "ACTIVE") return <CompanyUnavailable name={appt.company.name} status={appt.company.status} />;
  if (appt.status === "CANCELLED") return <Message title="Horário cancelado" text="Este horário foi cancelado. Se quiser, é só marcar outro." bookHref={`/agendar/${appt.company.slug}`} />;
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") return <Message title="Horário encerrado" text="Este atendimento já foi concluído." />;
  if (appt.startTime.getTime() < shopNow().getTime()) return <Message title="Horário já passou" text="Este horário já passou. Se precisar, marque um novo." bookHref={`/agendar/${appt.company.slug}`} />;

  const firstName = appt.customer?.fullName.split(" ")[0] ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardContent className="space-y-5 py-6">
          <div className="flex flex-col items-center gap-2 text-center">
            {appt.company.logoUrl && <CompanyLogo logoUrl={appt.company.logoUrl} name={appt.company.name} height={48} className="max-w-[160px]" />}
            <h1 className="text-xl font-semibold text-foreground">{firstName ? `${firstName}, confirme seu horário` : "Confirme seu horário"}</h1>
            <p className="text-sm text-foreground-muted">{appt.company.name}</p>
          </div>

          <dl className="space-y-3 rounded-xl bg-[var(--surface-subtle)] p-4 text-sm">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-4 w-4 shrink-0 text-secondary-light" />
              <dd className="font-medium text-foreground">
                {formatDate(appt.appointmentDate)} às {formatTime(appt.startTime)}
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-secondary-light" />
              <dd className="text-foreground">Barbeiro: {appt.barber.name}</dd>
            </div>
            <div className="flex items-start gap-3">
              <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-secondary-light" />
              <dd className="text-foreground">
                {appt.services.map((s) => s.serviceName).join(", ")}
                <span className="block text-foreground-muted">{formatCurrency(appt.totalPrice.toString())}</span>
              </dd>
            </div>
          </dl>

          <ConfirmPanel token={token} alreadyConfirmed={appt.clientConfirmedAt !== null} bookHref={`/agendar/${appt.company.slug}`} />
        </CardContent>
      </Card>
    </div>
  );
}
