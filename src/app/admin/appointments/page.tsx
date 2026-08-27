import Link from "next/link";
import { Plus } from "lucide-react";
import { listAppointments, type AppointmentRangeFilter } from "@/lib/data/appointments";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime, formatWhatsappDisplay } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppointmentRowActions } from "./row-actions";
import type { AppointmentStatus } from "@prisma/client";

const RANGES: { value: AppointmentRangeFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Todos" },
];

const STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; barberId?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const range = (sp.range as AppointmentRangeFilter) ?? "week";
  const barberId = sp.barberId || undefined;
  const status = (sp.status as AppointmentStatus) || undefined;

  const [appointments, barbers] = await Promise.all([
    listAppointments({ range, barberId, status, customerQuery: sp.q }),
    prisma.barber.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agendamentos</h1>
          <p className="text-sm text-foreground-muted">{appointments.length} agendamento(s) encontrados</p>
        </div>
        <Link href="/admin/appointments/new">
          <Button>
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/admin/appointments?range=${r.value}${barberId ? `&barberId=${barberId}` : ""}${status ? `&status=${status}` : ""}`}
          >
            <Button size="sm" variant={range === r.value ? "default" : "secondary"}>
              {r.label}
            </Button>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-3">
        <input type="hidden" name="range" value={range} />
        <Select name="barberId" defaultValue={barberId} className="w-48">
          <option value="">Todos os barbeiros</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status} className="w-48">
          <option value="">Todos os status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPOINTMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Input name="q" placeholder="Buscar cliente..." defaultValue={sp.q} className="w-56" />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Barbeiro</TableHead>
              <TableHead>Serviços</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appt) => (
              <TableRow key={appt.id}>
                <TableCell className="text-foreground">
                  {formatDate(appt.appointmentDate)}
                  <br />
                  <span className="text-xs text-foreground-muted">{formatTime(appt.startTime)}</span>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/customers/${appt.customerId}`} className="font-medium text-foreground hover:underline">
                    {appt.customer.fullName}
                  </Link>
                  <p className="text-xs text-foreground-muted">{formatWhatsappDisplay(appt.customer.whatsapp)}</p>
                </TableCell>
                <TableCell className="text-foreground-muted">{appt.barber.name}</TableCell>
                <TableCell className="text-foreground-muted">
                  {appt.services.map((s) => s.serviceName).join(", ")}
                </TableCell>
                <TableCell className="text-foreground-muted">{formatCurrency(appt.totalPrice.toString())}</TableCell>
                <TableCell>
                  <Badge variant={APPOINTMENT_STATUS_VARIANT[appt.status]}>{APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
                </TableCell>
                <TableCell>
                  <AppointmentRowActions id={appt.id} status={appt.status} hasPayment={appt.payments.length > 0} />
                </TableCell>
              </TableRow>
            ))}
            {appointments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-foreground-muted">
                  Nenhum agendamento neste período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
