import Link from "next/link";
import { CalendarDays, List, Plus } from "lucide-react";
import { listAppointments, listAppointmentsInRange, type AppointmentRangeFilter } from "@/lib/data/appointments";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime, formatWhatsappDisplay } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresh } from "@/components/auto-refresh";
import { AppointmentRowActions } from "./row-actions";
import { CalendarToolbar } from "./calendar/calendar-toolbar";
import { TimeGrid, type GridAppointment } from "./calendar/time-grid";
import { MonthGrid, type MonthAppointment } from "./calendar/month-grid";
import {
  addDays,
  dateOnlyUTC,
  gridHourBounds,
  parseAnchor,
  rangeForView,
  startOfMonth,
  toISODate,
  type CalendarView,
} from "./calendar/calendar-dates";
import type { AppointmentStatus } from "@prisma/client";
import { requireAdminContext } from "@/lib/require-admin";

const RANGES: { value: AppointmentRangeFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Todos" },
];

const STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; cal?: string; date?: string; range?: string; barberId?: string; status?: string; q?: string }>;
}) {
  const user = await requireAdminContext();
  const sp = await searchParams;
  const isCalendar = sp.view !== "list";
  const calendarView: CalendarView = CALENDAR_VIEWS.includes(sp.cal as CalendarView)
    ? (sp.cal as CalendarView)
    : "week";
  const anchor = parseAnchor(sp.date);
  const range = (sp.range as AppointmentRangeFilter) ?? "week";
  const barberId = sp.barberId || undefined;
  const status = (sp.status as AppointmentStatus) || undefined;

  /** Preserva os filtros ativos ao trocar de visão/período. */
  function buildHref(next: {
    view?: CalendarView;
    date?: string;
    mode?: "list" | "calendar";
    range?: AppointmentRangeFilter;
  }) {
    const params = new URLSearchParams();
    const mode = next.mode ?? (isCalendar ? "calendar" : "list");
    if (mode === "calendar") {
      params.set("cal", next.view ?? calendarView);
      params.set("date", next.date ?? toISODate(anchor));
    } else {
      params.set("view", "list");
      const listRange = next.range ?? (sp.range as AppointmentRangeFilter | undefined);
      if (listRange) params.set("range", listRange);
    }
    if (barberId) params.set("barberId", barberId);
    if (status) params.set("status", status);
    if (sp.q) params.set("q", sp.q);
    return `/admin/appointments?${params.toString()}`;
  }

  const { from, to } = rangeForView(calendarView, anchor);

  const [appointments, barbers] = await Promise.all([
    isCalendar
      ? listAppointmentsInRange(user.companyId, { from, to, barberId, status, customerQuery: sp.q })
      : listAppointments(user.companyId, { range, barberId, status, customerQuery: sp.q }),
    prisma.barber.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
  ]);

  const today = dateOnlyUTC(new Date());
  const dayCount = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));

  const toBlock = (appt: (typeof appointments)[number]) => ({
    id: appt.id,
    customerId: appt.customerId,
    customerName: appt.customer.fullName,
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName).join(", "),
    status: appt.status,
    statusLabel: APPOINTMENT_STATUS_LABEL[appt.status],
    timeLabel: `${formatTime(appt.startTime)}–${formatTime(appt.endTime)}`,
    price: formatCurrency(appt.totalPrice.toString()),
  });

  const renderActions = (appt: (typeof appointments)[number]) => (
    <AppointmentRowActions id={appt.id} status={appt.status} hasPayment={appt.payments.length > 0} />
  );

  return (
    <div className="space-y-6">
      <AutoRefresh />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agendamentos</h1>
          <p className="text-sm text-foreground-muted">{appointments.length} agendamento(s) no período</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border p-1">
            <Link
              href={buildHref({ mode: "calendar" })}
              className={
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all " +
                (isCalendar ? "bg-secondary text-white" : "text-foreground-muted hover:text-foreground")
              }
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </Link>
            <Link
              href={buildHref({ mode: "list" })}
              className={
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all " +
                (!isCalendar ? "bg-secondary text-white" : "text-foreground-muted hover:text-foreground")
              }
            >
              <List className="h-3.5 w-3.5" /> Lista
            </Link>
          </div>
          <Link href="/admin/appointments/new">
            <Button>
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros — compartilhados pelas duas visões */}
      <form className="flex flex-wrap gap-3">
        {isCalendar ? (
          <>
            <input type="hidden" name="cal" value={calendarView} />
            <input type="hidden" name="date" value={toISODate(anchor)} />
          </>
        ) : (
          <>
            <input type="hidden" name="view" value="list" />
            <input type="hidden" name="range" value={range} />
          </>
        )}
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

      {isCalendar ? (
        <div className="space-y-4">
          <CalendarToolbar view={calendarView} anchor={anchor} buildHref={buildHref} />
          <Card className="p-4">
            {calendarView === "month" ? (
              <MonthGrid
                days={days}
                month={startOfMonth(anchor).getUTCMonth()}
                today={today}
                appointments={appointments.map<MonthAppointment>((appt) => ({
                  block: toBlock(appt),
                  actions: renderActions(appt),
                  day: appt.appointmentDate,
                }))}
              />
            ) : (
              (() => {
                const { startHour, endHour } = gridHourBounds(appointments);
                return (
                  <TimeGrid
                    days={days}
                    startHour={startHour}
                    endHour={endHour}
                    today={today}
                    appointments={appointments.map<GridAppointment>((appt) => ({
                      block: toBlock(appt),
                      actions: renderActions(appt),
                      startTime: appt.startTime,
                      endTime: appt.endTime,
                      day: appt.appointmentDate,
                    }))}
                  />
                );
              })()
            )}
          </Card>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Link key={r.value} href={buildHref({ mode: "list", range: r.value })}>
                <Button size="sm" variant={range === r.value ? "default" : "secondary"}>
                  {r.label}
                </Button>
              </Link>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
