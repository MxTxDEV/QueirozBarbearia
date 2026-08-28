import type { Appointment, AppointmentService, Barber, Customer } from "@prisma/client";
import { formatTime } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";

type AgendaAppointment = Appointment & { customer: Customer; barber: Barber; services: AppointmentService[] };

export function TodayAgenda({ appointments }: { appointments: AgendaAppointment[] }) {
  if (appointments.length === 0) {
    return (
      <div className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Agenda de hoje</p>
        <p className="mt-8 text-center text-sm text-foreground-muted">Nenhum horário agendado para hoje.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Agenda de hoje</p>
        <p className="text-sm text-foreground-muted">{appointments.length} horário(s)</p>
      </div>
      <div className="mt-4 max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {appointments.map((appt) => (
          <div
            key={appt.id}
            className="flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <div className="w-14 shrink-0 text-sm font-semibold text-foreground">{formatTime(appt.startTime)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{appt.customer.fullName}</p>
              <p className="truncate text-xs text-foreground-muted">
                {appt.services.map((s) => s.serviceName).join(", ")} · {appt.barber.name}
              </p>
            </div>
            <Badge variant={APPOINTMENT_STATUS_VARIANT[appt.status]} className="shrink-0">
              {APPOINTMENT_STATUS_LABEL[appt.status]}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
