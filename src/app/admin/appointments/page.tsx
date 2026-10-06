import { shopNow } from "@/lib/shop-time";
import Link from "next/link";
import { CalendarDays, List, Plus, Repeat } from "lucide-react";
import { getAppointmentDayCounts, listAppointments, listAppointmentsInRange, type AppointmentRangeFilter } from "@/lib/data/appointments";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime, formatWhatsappDisplay } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AutoRefresh } from "@/components/auto-refresh";
import { AppointmentRowActions } from "./row-actions";
import { CalendarToolbar } from "./calendar/calendar-toolbar";
import { TimeGrid, type GridAppointment } from "./calendar/time-grid";
import { BarberDayGrid, type BarberDayAppointment } from "./calendar/barber-day-grid";
import { MonthGrid, type MonthAppointment } from "./calendar/month-grid";
import { MobileDayAgenda, MobileWeekAgenda, type DayAgendaItem, type WeekDaySection } from "./calendar/mobile-day-agenda";
import { MobileMonthGrid, type MonthDayCount } from "./calendar/mobile-month-grid";
import {
  addDays,
  dateOnlyUTC,
  gridHourBounds,
  isSameDay,
  parseAnchor,
  periodLabel,
  rangeForView,
  startOfMonth,
  startOfWeek,
  toISODate,
  type CalendarView,
} from "./calendar/calendar-dates";
import type { AppointmentStatus } from "@prisma/client";
import { requireAdminContext } from "@/lib/require-admin";
import { appointmentClientName } from "@/lib/appointment-client";
import { MiniCalendar } from "./calendar/mini-calendar";
import type { BreakInfo } from "./calendar/break-types";
import { getOpenIntervals, type DayAvailability } from "@/lib/data/calendar-availability";
import { openSlotStarts, minutesToHHMM, intersectSegments, coversWholeDay, type ClosedSegment } from "@/lib/quick-slots";

/** Os botões "+" do calendário são de 15 em 15 minutos — o mesmo passo do motor de disponibilidade. */
const QUICK_SLOT_STEP = 15;

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
  searchParams: Promise<{
    view?: string;
    cal?: string;
    date?: string;
    mday?: string;
    range?: string;
    barberId?: string;
    status?: string;
    q?: string;
    mini?: string;
  }>;
}) {
  const user = await requireAdminContext();
  const sp = await searchParams;
  const isCalendar = sp.view !== "list";
  const calendarView: CalendarView = CALENDAR_VIEWS.includes(sp.cal as CalendarView)
    ? (sp.cal as CalendarView)
    : "day";
  const anchor = parseAnchor(sp.date);
  const range = (sp.range as AppointmentRangeFilter) ?? "week";
  const isBarberLogin = user.role === "BARBER";
  // Login de barbeiro só vê os próprios atendimentos — nunca aceita um
  // barberId diferente vindo da URL, sempre o da própria sessão.
  const barberId = isBarberLogin ? (user.barberId ?? undefined) : sp.barberId || undefined;
  const status = (sp.status as AppointmentStatus) || undefined;
  // O carrossel mobile mostra sempre um dia por vez, independente da visão
  // de calendário escolhida no desktop (dia/semana/mês) — dia próprio
  // (mday), não o `date`/`cal` do calendário, pra não embaralhar os dois.
  const mobileDay = parseAnchor(sp.mday);

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

  /** Navegação de dia do carrossel mobile — independente do calendário do desktop. */
  function buildMobileDayHref(day: Date) {
    const params = new URLSearchParams();
    params.set("cal", calendarView);
    params.set("date", toISODate(anchor));
    params.set("mday", toISODate(day));
    if (barberId) params.set("barberId", barberId);
    if (status) params.set("status", status);
    if (sp.q) params.set("q", sp.q);
    return `/admin/appointments?${params.toString()}`;
  }

  /** Toca num dia da grade mensal (mobile) → vai direto pra visão de Dia daquela data. */
  function buildMonthDayHref(day: Date) {
    const params = new URLSearchParams();
    params.set("cal", "day");
    params.set("date", toISODate(day));
    params.set("mday", toISODate(day));
    if (barberId) params.set("barberId", barberId);
    if (status) params.set("status", status);
    if (sp.q) params.set("q", sp.q);
    return `/admin/appointments?${params.toString()}`;
  }

  /** Atalho do calendário: abre "Novo agendamento" já com data/hora/barbeiro preenchidos. */
  function buildNewHref(args: { date: string; time?: string; barberId?: string }) {
    const params = new URLSearchParams({ date: args.date });
    if (args.time) params.set("time", args.time);
    const targetBarber = args.barberId ?? barberId;
    if (targetBarber) params.set("barberId", targetBarber);
    return `/admin/appointments/new?${params.toString()}`;
  }

  const { from, to } = rangeForView(calendarView, anchor);

  // Mini calendário lateral: mês exibido (padrão: o da data em foco) e os dias com agendamento.
  const miniMonth =
    sp.mini && /^\d{4}-\d{2}$/.test(sp.mini) ? startOfMonth(new Date(`${sp.mini}-01T00:00:00.000Z`)) : startOfMonth(anchor);
  const miniMonthKey = (d: Date) => toISODate(startOfMonth(d)).slice(0, 7);
  const miniGridStart = startOfWeek(miniMonth);
  /** Troca só o mês do mini calendário, preservando visão, data e filtros da agenda principal. */
  function buildMiniHref(target: Date) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) if (value) params.set(key, value);
    params.set("mini", miniMonthKey(target));
    return `/admin/appointments?${params.toString()}`;
  }

  const [appointments, barbers, mobileDayAppointments, miniCounts] = await Promise.all([
    isCalendar
      ? listAppointmentsInRange(user.companyId, { from, to, barberId, status, customerQuery: sp.q })
      : listAppointments(user.companyId, { range, barberId, status, customerQuery: sp.q }),
    isBarberLogin ? Promise.resolve([]) : prisma.barber.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    isCalendar && calendarView === "day"
      ? listAppointmentsInRange(user.companyId, { from: mobileDay, to: addDays(mobileDay, 1), barberId, status, customerQuery: sp.q })
      : Promise.resolve([]),
    isCalendar
      ? getAppointmentDayCounts(user.companyId, { from: miniGridStart, to: addDays(miniGridStart, 42), barberId })
      : Promise.resolve({}),
  ]);

  const today = dateOnlyUTC(shopNow());
  const dayCount = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));

  // Horários livres pros botões de agendamento rápido (Dia e Semana). Uma
  // consulta por fonte pro período todo — ver getOpenIntervals.
  const quickBarberIds = isBarberLogin
    ? user.barberId
      ? [user.barberId]
      : []
    : barberId
      ? [barberId]
      : barbers.map((b) => b.id);
  const openIntervals =
    isCalendar && quickBarberIds.length > 0
      ? await getOpenIntervals(user.companyId, quickBarberIds, from, to)
      : new Map<string, DayAvailability>();
  const nowUtc = shopNow();
  /** Minuto a partir do qual um dia ainda aceita agendamento: nada em dias passados, só o futuro hoje. */
  const notBeforeMinute = (day: Date) =>
    day.getTime() < today.getTime() ? Infinity : isSameDay(day, today) ? nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() : 0;

  /** Trechos fechados de um dia que valem pra TODOS os barbeiros considerados (se um atende, o horário não é trancado). */
  const closedForAllBarbers = (availability: Map<string, DayAvailability>, day: Date): ClosedSegment[] => {
    const perBarber = quickBarberIds.map((id) => availability.get(`${id}|${toISODate(day)}`)?.closed ?? []);
    if (perBarber.length === 0) return [];
    return perBarber.reduce((acc, segs) => intersectSegments(acc, segs));
  };

  const dayOpenSlots: Record<string, number[]> = {};
  const dayClosedSegments: Record<string, ClosedSegment[]> = {};
  const weekOpenSlots: Record<string, { minute: number; barberId?: string }[]> = {};
  const weekClosedSegments: Record<string, ClosedSegment[]> = {};
  const closedDayKeys = new Set<string>();

  // Intervalo (almoço) arrastável: Dia = um por barbeiro/coluna; Semana e Mês só quando há UM barbeiro no contexto
  // (com vários numa mesma coluna não dá pra saber de quem é o intervalo que se está movendo).
  const barberNameById = new Map<string, string>(barbers.map((b) => [b.id, b.name]));
  if (isBarberLogin && user.barberId) barberNameById.set(user.barberId, user.name);
  const breakInfoFor = (id: string, day: Date): BreakInfo | undefined => {
    if (day.getTime() < today.getTime()) return undefined;
    const a = openIntervals.get(`${id}|${toISODate(day)}`);
    if (!a?.working || !a.breakWindow) return undefined;
    return {
      barberId: id,
      barberName: barberNameById.get(id) ?? "Barbeiro",
      date: toISODate(day),
      start: a.breakWindow.start,
      end: a.breakWindow.end,
      workStart: a.working.start,
      workEnd: a.working.end,
      busy: a.busy,
      isOverride: a.breakIsOverride,
    };
  };
  const singleBarberId = quickBarberIds.length === 1 ? quickBarberIds[0] : null;
  const dayBreakInfo: Record<string, BreakInfo | undefined> = {};
  const rangeBreakInfo: Record<string, BreakInfo | undefined> = {};
  if (calendarView === "day") {
    for (const id of quickBarberIds) dayBreakInfo[id] = breakInfoFor(id, from);
  } else if (singleBarberId) {
    for (const day of days) rangeBreakInfo[toISODate(day)] = breakInfoFor(singleBarberId, day);
  }
  if (calendarView === "day") {
    for (const id of quickBarberIds) {
      const info = openIntervals.get(`${id}|${toISODate(from)}`);
      dayOpenSlots[id] = openSlotStarts(info?.open ?? [], QUICK_SLOT_STEP, notBeforeMinute(from));
      dayClosedSegments[id] = info?.closed ?? [];
    }
  } else if (calendarView === "week") {
    for (const day of days) {
      const firstBarberByMinute = new Map<number, string>();
      for (const id of quickBarberIds) {
        const open = openIntervals.get(`${id}|${toISODate(day)}`)?.open ?? [];
        for (const minute of openSlotStarts(open, QUICK_SLOT_STEP, notBeforeMinute(day))) {
          if (!firstBarberByMinute.has(minute)) firstBarberByMinute.set(minute, id);
        }
      }
      weekOpenSlots[toISODate(day)] = [...firstBarberByMinute.entries()]
        .sort((a, b) => a[0] - b[0])
        // Com um barbeiro só no filtro o form já o recebe pelo próprio filtro; sem filtro, pré-seleciona o 1º livre.
        .map(([minute, id]) => ({ minute, barberId: id }));
      weekClosedSegments[toISODate(day)] = closedForAllBarbers(openIntervals, day);
    }
  }
  for (const day of days) {
    if (coversWholeDay(closedForAllBarbers(openIntervals, day))) closedDayKeys.add(toISODate(day));
  }

  // Celular, visão de Dia: disponibilidade do dia exibido (pode ser outro dia que o do desktop).
  const mobileAvailability =
    isCalendar && calendarView === "day" && quickBarberIds.length > 0
      ? await getOpenIntervals(user.companyId, quickBarberIds, mobileDay, addDays(mobileDay, 1))
      : new Map<string, DayAvailability>();
  const mobileDayClosed = calendarView === "day" && coversWholeDay(closedForAllBarbers(mobileAvailability, mobileDay));
  // Chips com os horários livres, só quando o contexto é de UM barbeiro.
  const mobileFreeSlots =
    calendarView === "day" && quickBarberIds.length === 1 && mobileDay.getTime() >= today.getTime()
      ? openSlotStarts(
          mobileAvailability.get(`${quickBarberIds[0]}|${toISODate(mobileDay)}`)?.open ?? [],
          QUICK_SLOT_STEP,
          notBeforeMinute(mobileDay)
        ).map((m) => ({
          label: minutesToHHMM(m),
          href: buildNewHref({ date: toISODate(mobileDay), time: minutesToHHMM(m), barberId: quickBarberIds[0] }),
        }))
      : [];

  // Visão de Dia: uma coluna fixa por barbeiro lado a lado (Regra: nunca
  // misturar agendamentos de barbeiros diferentes na mesma coluna/lane).
  // Login de barbeiro só tem a própria coluna; filtro de barbeiro específico
  // reduz pra uma coluna só; sem filtro, mostra todos os barbeiros.
  const dayViewBarbers = isBarberLogin
    ? user.barberId
      ? [{ id: user.barberId, name: user.name }]
      : []
    : barberId
      ? barbers.filter((b) => b.id === barberId)
      : barbers;

  const toBlock = (appt: (typeof appointments)[number]) => ({
    id: appt.id,
    customerId: appt.customerId,
    customerName: appointmentClientName(appt),
    notes: appt.notes,
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName).join(", "),
    status: appt.status,
    statusLabel: APPOINTMENT_STATUS_LABEL[appt.status],
    timeLabel: `${formatTime(appt.startTime)}–${formatTime(appt.endTime)}`,
    price: formatCurrency(appt.totalPrice.toString()),
  });

  const renderActions = (appt: (typeof appointments)[number]) => (
    <AppointmentRowActions key={appt.id} id={appt.id} status={appt.status} hasPayment={appt.payments.length > 0} />
  );

  // Visão de Semana no celular: um carrossel por dia, empilhados.
  const daySections: WeekDaySection[] = days.map((day) => ({
    day,
    dayLabel: periodLabel("day", day),
    isToday: isSameDay(day, today),
    newHref: day.getTime() >= today.getTime() && !closedDayKeys.has(toISODate(day)) ? buildNewHref({ date: toISODate(day) }) : undefined,
    closed: closedDayKeys.has(toISODate(day)),
    items: appointments
      .filter((appt) => isSameDay(appt.appointmentDate, day))
      .map<DayAgendaItem>((appt) => ({
        block: toBlock(appt),
        actions: renderActions(appt),
        startTime: appt.startTime,
        endTime: appt.endTime,
      })),
  }));

  // Visão de Mês no celular: só a contagem por dia (grade compacta,
  // tocar num dia leva pra visão de Dia) — não precisa dos cards inteiros.
  const monthCounts: MonthDayCount[] = days.map((day) => {
    const dayAppointments = appointments.filter((appt) => isSameDay(appt.appointmentDate, day));
    return {
      day,
      count: dayAppointments.length,
      hasPending: dayAppointments.some((appt) => appt.status === "PENDING"),
    };
  });

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
                (isCalendar ? "bg-secondary-dark text-white" : "text-foreground-muted hover:text-foreground")
              }
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </Link>
            <Link
              href={buildHref({ mode: "list" })}
              className={
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all " +
                (!isCalendar ? "bg-secondary-dark text-white" : "text-foreground-muted hover:text-foreground")
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
        {!isBarberLogin && (
          <Select name="barberId" defaultValue={barberId} className="w-48" aria-label="Filtrar por barbeiro">
            <option value="">Todos os barbeiros</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
        <Select name="status" defaultValue={status} className="w-48" aria-label="Filtrar por status">
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
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-6">
        <div className="min-w-0 space-y-4">
          <CalendarToolbar view={calendarView} anchor={anchor} buildHref={buildHref} />

          {calendarView === "day" ? (
            <MobileDayAgenda
              dayLabel={periodLabel("day", mobileDay)}
              isToday={isSameDay(mobileDay, today)}
              prevHref={buildMobileDayHref(addDays(mobileDay, -1))}
              nextHref={buildMobileDayHref(addDays(mobileDay, 1))}
              todayHref={buildMobileDayHref(today)}
              newHref={mobileDay.getTime() >= today.getTime() && !mobileDayClosed ? buildNewHref({ date: toISODate(mobileDay) }) : undefined}
              freeSlots={mobileFreeSlots}
              closed={mobileDayClosed}
              items={mobileDayAppointments.map<DayAgendaItem>((appt) => ({
                block: toBlock(appt),
                actions: renderActions(appt),
                startTime: appt.startTime,
                endTime: appt.endTime,
              }))}
            />
          ) : calendarView === "month" ? (
            <MobileMonthGrid
              days={days}
              month={startOfMonth(anchor).getUTCMonth()}
              today={today}
              counts={monthCounts}
              closedDays={closedDayKeys}
              buildHref={buildMonthDayHref}
            />
          ) : (
            <MobileWeekAgenda days={daySections} />
          )}

          <Card className="hidden p-4 md:block">
            {calendarView === "month" ? (
              <MonthGrid
                days={days}
                month={startOfMonth(anchor).getUTCMonth()}
                today={today}
                buildNewHref={(day) => buildNewHref({ date: toISODate(day) })}
                closedDays={closedDayKeys}
                breakInfo={rangeBreakInfo}
                appointments={appointments.map<MonthAppointment>((appt) => ({
                  block: toBlock(appt),
                  actions: renderActions(appt),
                  day: appt.appointmentDate,
                }))}
              />
            ) : calendarView === "day" ? (
              (() => {
                const { startHour, endHour } = gridHourBounds(appointments);
                return (
                  <BarberDayGrid
                    barbers={dayViewBarbers}
                    startHour={startHour}
                    endHour={endHour}
                    openSlots={dayOpenSlots}
                    closedSegments={dayClosedSegments}
                    breakInfo={dayBreakInfo}
                    buildNewHref={({ time, barberId: slotBarberId }) =>
                      buildNewHref({ date: toISODate(from), time, barberId: slotBarberId })
                    }
                    emptyBarberLabel={
                      isBarberLogin ? "Nenhum barbeiro vinculado a este login." : "Cadastre um barbeiro pra ver a agenda por aqui."
                    }
                    appointments={appointments.map<BarberDayAppointment>((appt) => ({
                      block: toBlock(appt),
                      actions: renderActions(appt),
                      startTime: appt.startTime,
                      endTime: appt.endTime,
                      day: appt.appointmentDate,
                      barberId: appt.barberId,
                    }))}
                  />
                );
              })()
            ) : (
              (() => {
                const { startHour, endHour } = gridHourBounds(appointments);
                return (
                  <TimeGrid
                    days={days}
                    startHour={startHour}
                    endHour={endHour}
                    today={today}
                    openSlots={weekOpenSlots}
                    closedSegments={weekClosedSegments}
                    breakInfo={rangeBreakInfo}
                    breakMoveHint={singleBarberId ? undefined : "filtre um barbeiro para mover o intervalo"}
                    buildNewHref={buildNewHref}
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
        <aside className="hidden xl:sticky xl:top-4 xl:block">
          <MiniCalendar
            month={miniMonth}
            selected={anchor}
            today={today}
            counts={miniCounts}
            prevHref={buildMiniHref(addDays(miniMonth, -1))}
            nextHref={buildMiniHref(addDays(miniMonth, 32))}
            todayHref={buildHref({ date: toISODate(today) })}
            buildDayHref={(day) => buildHref({ date: toISODate(day) })}
          />
        </aside>
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

          <Card variant="solid">
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
                      <div className="flex items-center gap-1.5">
                        {appt.customerId ? (
                          <Link href={`/admin/customers/${appt.customerId}`} className="font-medium text-foreground hover:underline">
                            {appointmentClientName(appt)}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{appointmentClientName(appt)}</span>
                        )}
                        {appt.recurringOccurrence && (
                          <Link
                            href={`/admin/recurring-appointments/${appt.recurringOccurrence.recurringAppointmentId}`}
                            title="Faz parte de uma recorrência"
                            className="text-secondary-light"
                          >
                            <Repeat className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-foreground-muted">
                        {appt.customer ? formatWhatsappDisplay(appt.customer.whatsapp) : "Cliente avulso"}
                        {appt.notes ? ` · ${appt.notes}` : ""}
                      </p>
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
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={CalendarDays}
                        title="Nenhum agendamento neste período"
                        description="Experimente trocar o filtro de período ou crie um novo agendamento."
                        action={
                          <Link href="/admin/appointments/new">
                            <Button size="sm">
                              <Plus className="h-4 w-4" /> Novo agendamento
                            </Button>
                          </Link>
                        }
                      />
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
